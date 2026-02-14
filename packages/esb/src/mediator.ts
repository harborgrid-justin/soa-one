// ============================================================
// SOA One ESB — Protocol Mediator
// ============================================================
//
// Mediates between different protocols, transforming messages
// from one protocol format to another. Supports REST, SOAP,
// JMS, FTP, database, email, WebSocket, gRPC, Kafka, AMQP,
// MQTT, and custom protocols.
//
// Beyond Oracle ESB:
// - Bidirectional mediation rules
// - Protocol-specific header mapping
// - Automatic content-type negotiation
// - Protocol chain mediation (A → B → C)
// - Runtime protocol registration
// ============================================================

import type {
  ESBMessage,
  EndpointProtocol,
  MediationRule,
  TransformerConfig,
  ProtocolConfig,
} from './types';
import { createMessage, generateId } from './channel';
import { MessageTransformer } from './transformer';

// ── Protocol Adapter Interface ────────────────────────────────

/** Abstract protocol adapter that converts messages. */
export interface ProtocolAdapter {
  /** Protocol name. */
  readonly protocol: EndpointProtocol;

  /** Convert an ESB message to protocol-specific format. */
  serialize(message: ESBMessage, config?: ProtocolConfig): any;

  /** Convert protocol-specific data back to an ESB message. */
  deserialize(data: any, config?: ProtocolConfig): ESBMessage;

  /** Get default content type for this protocol. */
  getContentType(): string;

  /** Get default headers for this protocol. */
  getDefaultHeaders(): Record<string, string>;
}

// ── Built-in Protocol Adapters ────────────────────────────────

/** REST/JSON protocol adapter. */
export class RestProtocolAdapter implements ProtocolAdapter {
  readonly protocol: EndpointProtocol = 'rest';

  serialize(message: ESBMessage, config?: ProtocolConfig): any {
    return {
      method: config?.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
        'X-Correlation-ID': message.correlationId ?? message.id,
        'X-Message-ID': message.id,
        ...(message.headers.tenantId ? { 'X-Tenant-ID': String(message.headers.tenantId) } : {}),
      },
      queryParams: config?.queryParams ?? {},
      body: JSON.stringify(message.body),
    };
  }

  deserialize(data: any, _config?: ProtocolConfig): ESBMessage {
    const body = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    return createMessage(body, {
      correlationId: data.headers?.['X-Correlation-ID'] ?? data.headers?.['x-correlation-id'],
      headers: {
        contentType: 'application/json',
        source: data.url ?? data.path,
        messageType: data.headers?.['X-Message-Type'] ?? data.headers?.['x-message-type'],
      },
      contentType: 'application/json',
    });
  }

  getContentType(): string {
    return 'application/json';
  }

  getDefaultHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', Accept: 'application/json' };
  }
}

/** SOAP/XML protocol adapter. */
export class SoapProtocolAdapter implements ProtocolAdapter {
  readonly protocol: EndpointProtocol = 'soap';

  serialize(message: ESBMessage, config?: ProtocolConfig): any {
    const soapBody = this._jsonToSoapXml(message.body);
    const envelope = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
      '  <soap:Header>',
      `    <MessageID>${message.id}</MessageID>`,
      message.correlationId ? `    <CorrelationID>${message.correlationId}</CorrelationID>` : '',
      '  </soap:Header>',
      '  <soap:Body>',
      `    ${soapBody}`,
      '  </soap:Body>',
      '</soap:Envelope>',
    ].filter(Boolean).join('\n');

    return {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: config?.soapAction ?? '',
        ...config?.headers,
      },
      body: envelope,
    };
  }

  deserialize(data: any, _config?: ProtocolConfig): ESBMessage {
    // Simplified XML → JSON conversion
    const body = typeof data.body === 'string'
      ? this._extractSoapBody(data.body)
      : data.body;

    return createMessage(body, {
      headers: {
        contentType: 'text/xml',
        source: data.url ?? 'soap-endpoint',
      },
      contentType: 'text/xml',
    });
  }

  getContentType(): string {
    return 'text/xml; charset=utf-8';
  }

  getDefaultHeaders(): Record<string, string> {
    return { 'Content-Type': 'text/xml; charset=utf-8' };
  }

  private _jsonToSoapXml(obj: any, rootTag: string = 'Data'): string {
    if (obj === null || obj === undefined) return `<${rootTag}/>`;
    if (typeof obj !== 'object') return `<${rootTag}>${this._escapeXml(String(obj))}</${rootTag}>`;

    const parts: string[] = [`<${rootTag}>`];
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          parts.push(this._jsonToSoapXml(item, key));
        }
      } else if (typeof value === 'object' && value !== null) {
        parts.push(this._jsonToSoapXml(value, key));
      } else {
        parts.push(`<${key}>${this._escapeXml(String(value ?? ''))}</${key}>`);
      }
    }
    parts.push(`</${rootTag}>`);
    return parts.join('');
  }

  private _escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private _extractSoapBody(xml: string): Record<string, any> {
    // Simple extraction: get content between <soap:Body> and </soap:Body>
    const bodyMatch = xml.match(/<soap:Body[^>]*>([\s\S]*?)<\/soap:Body>/i);
    if (!bodyMatch) return { rawXml: xml };

    // Very simplified XML → JSON (production would use a real parser)
    return { soapBodyXml: bodyMatch[1].trim(), rawXml: xml };
  }
}

/** JMS-like message protocol adapter. */
export class JmsProtocolAdapter implements ProtocolAdapter {
  readonly protocol: EndpointProtocol = 'jms';

  serialize(message: ESBMessage, config?: ProtocolConfig): any {
    return {
      destination: config?.topic ?? 'default',
      deliveryMode: 'PERSISTENT',
      priority: this._mapPriority(message.priority),
      messageType: 'TextMessage',
      properties: {
        JMSCorrelationID: message.correlationId ?? message.id,
        JMSMessageID: message.id,
        JMSTimestamp: new Date(message.timestamp).getTime(),
        JMSExpiration: message.expiration ?? 0,
        JMSReplyTo: message.replyTo ?? '',
        ...Object.entries(message.headers).reduce((acc, [k, v]) => {
          if (v !== undefined) acc[k] = String(v);
          return acc;
        }, {} as Record<string, string>),
      },
      body: JSON.stringify(message.body),
    };
  }

  deserialize(data: any, _config?: ProtocolConfig): ESBMessage {
    const body = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    return createMessage(body, {
      correlationId: data.properties?.JMSCorrelationID,
      headers: {
        contentType: 'application/json',
        source: data.destination,
      },
      replyTo: data.properties?.JMSReplyTo,
      priority: this._unmapPriority(data.priority),
    });
  }

  getContentType(): string {
    return 'application/json';
  }

  getDefaultHeaders(): Record<string, string> {
    return {};
  }

  private _mapPriority(priority: string): number {
    switch (priority) {
      case 'lowest': return 0;
      case 'low': return 2;
      case 'normal': return 4;
      case 'high': return 7;
      case 'highest': return 9;
      default: return 4;
    }
  }

  private _unmapPriority(priority: number): 'lowest' | 'low' | 'normal' | 'high' | 'highest' {
    if (priority <= 1) return 'lowest';
    if (priority <= 3) return 'low';
    if (priority <= 5) return 'normal';
    if (priority <= 7) return 'high';
    return 'highest';
  }
}

// ── Protocol Mediator ─────────────────────────────────────────

/**
 * Mediates between protocols by converting messages from one
 * protocol format to another using registered adapters and
 * mediation rules.
 */
export class ProtocolMediator {
  private _adapters: Map<EndpointProtocol, ProtocolAdapter> = new Map();
  private _rules: MediationRule[] = [];
  private _transformer: MessageTransformer = new MessageTransformer();

  constructor() {
    // Register built-in adapters
    this.registerAdapter(new RestProtocolAdapter());
    this.registerAdapter(new SoapProtocolAdapter());
    this.registerAdapter(new JmsProtocolAdapter());
  }

  // ── Adapter Management ──────────────────────────────────

  /** Register a protocol adapter. */
  registerAdapter(adapter: ProtocolAdapter): void {
    this._adapters.set(adapter.protocol, adapter);
  }

  /** Get a protocol adapter. */
  getAdapter(protocol: EndpointProtocol): ProtocolAdapter | undefined {
    return this._adapters.get(protocol);
  }

  /** List registered protocols. */
  get registeredProtocols(): EndpointProtocol[] {
    return Array.from(this._adapters.keys());
  }

  // ── Mediation Rule Management ───────────────────────────

  /** Add a mediation rule. */
  addRule(rule: MediationRule): void {
    this._rules.push(rule);
  }

  /** Remove a mediation rule by name. */
  removeRule(name: string): boolean {
    const idx = this._rules.findIndex((r) => r.name === name);
    if (idx >= 0) {
      this._rules.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Get all mediation rules. */
  get rules(): MediationRule[] {
    return [...this._rules];
  }

  // ── Mediation ───────────────────────────────────────────

  /**
   * Mediate a message from one protocol to another.
   * Uses registered adapters and applicable mediation rules.
   */
  mediate(
    message: ESBMessage,
    sourceProtocol: EndpointProtocol,
    targetProtocol: EndpointProtocol,
  ): ESBMessage {
    if (sourceProtocol === targetProtocol) return message;

    // Find applicable mediation rule
    const rule = this._rules.find(
      (r) =>
        r.sourceProtocol === sourceProtocol &&
        r.targetProtocol === targetProtocol,
    );

    let result = { ...message, headers: { ...message.headers }, metadata: { ...message.metadata } };

    // Apply request transformation if defined in the rule
    if (rule?.requestTransformer) {
      result = this._transformer.applyTransform(result, rule.requestTransformer);
    }

    // Apply header mappings
    if (rule?.headerMappings) {
      for (const [sourceHeader, targetHeader] of Object.entries(rule.headerMappings)) {
        const value = result.headers[sourceHeader];
        if (value !== undefined) {
          result.headers[targetHeader] = value;
        }
      }
    }

    // Update content type for target protocol
    const targetAdapter = this._adapters.get(targetProtocol);
    if (targetAdapter) {
      result.contentType = targetAdapter.getContentType();
      result.headers.contentType = targetAdapter.getContentType();
    }

    // Add mediation metadata
    result.metadata.mediation = {
      sourceProtocol,
      targetProtocol,
      rule: rule?.name ?? 'default',
      mediatedAt: new Date().toISOString(),
    };

    return result;
  }

  /**
   * Serialize an ESB message to a protocol-specific format.
   */
  serialize(
    message: ESBMessage,
    protocol: EndpointProtocol,
    config?: ProtocolConfig,
  ): any {
    const adapter = this._adapters.get(protocol);
    if (!adapter) {
      throw new Error(`No adapter registered for protocol "${protocol}".`);
    }
    return adapter.serialize(message, config);
  }

  /**
   * Deserialize protocol-specific data back to an ESB message.
   */
  deserialize(
    data: any,
    protocol: EndpointProtocol,
    config?: ProtocolConfig,
  ): ESBMessage {
    const adapter = this._adapters.get(protocol);
    if (!adapter) {
      throw new Error(`No adapter registered for protocol "${protocol}".`);
    }
    return adapter.deserialize(data, config);
  }

  /**
   * Chain mediation: convert through intermediate protocols.
   * e.g., SOAP → REST → Kafka
   */
  mediateChain(
    message: ESBMessage,
    protocols: EndpointProtocol[],
  ): ESBMessage {
    if (protocols.length < 2) return message;

    let result = message;
    for (let i = 0; i < protocols.length - 1; i++) {
      result = this.mediate(result, protocols[i], protocols[i + 1]);
    }
    return result;
  }
}
