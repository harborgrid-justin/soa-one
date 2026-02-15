// ============================================================
// SOA One ESB — WS-ReliableMessaging
// ============================================================
//
// Oracle SOA Suite WS-ReliableMessaging equivalent. Provides
// reliable, ordered, exactly-once delivery of messages between
// endpoints using sequences with acknowledgment, retransmission,
// and sequence lifecycle management.
// ============================================================

import { generateId } from './channel';

// ── Types ────────────────────────────────────────────────────

export type SequenceState = 'created' | 'active' | 'closing' | 'closed' | 'terminated';
export type AckPolicy = 'per-message' | 'batched' | 'deferred';
export type DeliveryAssurance = 'at-most-once' | 'at-least-once' | 'exactly-once' | 'in-order';

export interface ReliableSequence {
  id: string;
  sourceEndpoint: string;
  destinationEndpoint: string;
  state: SequenceState;
  deliveryAssurance: DeliveryAssurance;
  ackPolicy: AckPolicy;
  expiresAt?: string;
  maxRetransmissions: number;
  retransmissionIntervalMs: number;
  inactivityTimeoutMs: number;
  lastMessageNumber: number;
  acknowledgedUpTo: number;
  pendingAcks: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ReliableMessage {
  id: string;
  sequenceId: string;
  messageNumber: number;
  payload: any;
  headers: Record<string, string>;
  sentAt: string;
  acknowledgedAt?: string;
  retransmissions: number;
  status: 'pending' | 'sent' | 'acknowledged' | 'failed';
}

export interface SequenceAcknowledgment {
  id: string;
  sequenceId: string;
  ranges: AckRange[];
  nacks: number[];
  receivedAt: string;
}

export interface AckRange {
  lower: number;
  upper: number;
}

export interface RMPolicy {
  id: string;
  name: string;
  deliveryAssurance: DeliveryAssurance;
  ackPolicy: AckPolicy;
  maxRetransmissions: number;
  retransmissionIntervalMs: number;
  inactivityTimeoutMs: number;
  sequenceExpirationMs: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── ReliableMessagingManager ─────────────────────────────────

export class ReliableMessagingManager {
  private _sequences = new Map<string, ReliableSequence>();
  private _messages: ReliableMessage[] = [];
  private _acks: SequenceAcknowledgment[] = [];
  private _policies = new Map<string, RMPolicy>();
  private _onAck: ((ack: SequenceAcknowledgment) => void) | null = null;
  private _onRetransmit: ((msg: ReliableMessage) => void) | null = null;
  private _onSequenceComplete: ((seq: ReliableSequence) => void) | null = null;

  // ── Sequences ──

  createSequence(seq: Omit<ReliableSequence, 'id' | 'state' | 'lastMessageNumber' | 'acknowledgedUpTo' | 'pendingAcks' | 'createdAt' | 'updatedAt'>): ReliableSequence {
    const now = new Date().toISOString();
    const s: ReliableSequence = {
      ...seq,
      id: generateId(),
      state: 'active',
      lastMessageNumber: 0,
      acknowledgedUpTo: 0,
      pendingAcks: [],
      createdAt: now,
      updatedAt: now,
    };
    this._sequences.set(s.id, s);
    return s;
  }

  getSequence(id: string): ReliableSequence | undefined {
    return this._sequences.get(id);
  }

  getSequencesByEndpoint(endpoint: string): ReliableSequence[] {
    return [...this._sequences.values()].filter(
      s => s.sourceEndpoint === endpoint || s.destinationEndpoint === endpoint
    );
  }

  closeSequence(id: string): ReliableSequence {
    const s = this._sequences.get(id);
    if (!s) throw new Error(`Sequence not found: ${id}`);
    s.state = 'closing';
    s.updatedAt = new Date().toISOString();
    // If all messages acknowledged, mark closed
    if (s.acknowledgedUpTo >= s.lastMessageNumber && s.pendingAcks.length === 0) {
      s.state = 'closed';
      this._onSequenceComplete?.(s);
    }
    return s;
  }

  terminateSequence(id: string): ReliableSequence {
    const s = this._sequences.get(id);
    if (!s) throw new Error(`Sequence not found: ${id}`);
    s.state = 'terminated';
    s.updatedAt = new Date().toISOString();
    return s;
  }

  removeSequence(id: string): boolean {
    this._messages = this._messages.filter(m => m.sequenceId !== id);
    this._acks = this._acks.filter(a => a.sequenceId !== id);
    return this._sequences.delete(id);
  }

  get allSequences(): ReliableSequence[] {
    return [...this._sequences.values()];
  }

  // ── Messages ──

  sendMessage(sequenceId: string, payload: any, headers: Record<string, string> = {}): ReliableMessage {
    const seq = this._sequences.get(sequenceId);
    if (!seq) throw new Error(`Sequence not found: ${sequenceId}`);
    if (seq.state !== 'active') throw new Error(`Sequence not active: ${seq.state}`);

    seq.lastMessageNumber++;
    const now = new Date().toISOString();
    const msg: ReliableMessage = {
      id: generateId(),
      sequenceId,
      messageNumber: seq.lastMessageNumber,
      payload,
      headers,
      sentAt: now,
      retransmissions: 0,
      status: 'sent',
    };
    seq.pendingAcks.push(msg.messageNumber);
    seq.updatedAt = now;
    this._messages.push(msg);
    return msg;
  }

  getMessage(id: string): ReliableMessage | undefined {
    return this._messages.find(m => m.id === id);
  }

  getMessagesBySequence(sequenceId: string): ReliableMessage[] {
    return this._messages.filter(m => m.sequenceId === sequenceId);
  }

  getPendingMessages(sequenceId: string): ReliableMessage[] {
    return this._messages.filter(m => m.sequenceId === sequenceId && m.status === 'sent');
  }

  retransmitMessage(messageId: string): ReliableMessage {
    const msg = this._messages.find(m => m.id === messageId);
    if (!msg) throw new Error(`Message not found: ${messageId}`);

    const seq = this._sequences.get(msg.sequenceId);
    if (seq && msg.retransmissions >= seq.maxRetransmissions) {
      msg.status = 'failed';
      throw new Error(`Max retransmissions exceeded for message ${messageId}`);
    }

    msg.retransmissions++;
    msg.sentAt = new Date().toISOString();
    this._onRetransmit?.(msg);
    return msg;
  }

  // ── Acknowledgments ──

  acknowledge(sequenceId: string, ranges: AckRange[], nacks: number[] = []): SequenceAcknowledgment {
    const seq = this._sequences.get(sequenceId);
    if (!seq) throw new Error(`Sequence not found: ${sequenceId}`);

    const now = new Date().toISOString();
    const ack: SequenceAcknowledgment = {
      id: generateId(),
      sequenceId,
      ranges,
      nacks,
      receivedAt: now,
    };
    this._acks.push(ack);

    // Mark messages as acknowledged
    for (const range of ranges) {
      for (let n = range.lower; n <= range.upper; n++) {
        const msg = this._messages.find(m => m.sequenceId === sequenceId && m.messageNumber === n);
        if (msg) {
          msg.status = 'acknowledged';
          msg.acknowledgedAt = now;
        }
        seq.pendingAcks = seq.pendingAcks.filter(p => p !== n);
      }
    }

    // Update acknowledged-up-to
    const sorted = [...(this._messages
      .filter(m => m.sequenceId === sequenceId && m.status === 'acknowledged')
      .map(m => m.messageNumber))].sort((a, b) => a - b);
    let upTo = 0;
    for (const n of sorted) {
      if (n === upTo + 1) upTo = n;
      else break;
    }
    seq.acknowledgedUpTo = upTo;
    seq.updatedAt = now;

    // Check if closing sequence is now complete
    if (seq.state === 'closing' && seq.acknowledgedUpTo >= seq.lastMessageNumber && seq.pendingAcks.length === 0) {
      seq.state = 'closed';
      this._onSequenceComplete?.(seq);
    }

    this._onAck?.(ack);
    return ack;
  }

  getAcknowledgments(sequenceId: string): SequenceAcknowledgment[] {
    return this._acks.filter(a => a.sequenceId === sequenceId);
  }

  // ── Policies ──

  createPolicy(policy: Omit<RMPolicy, 'id' | 'createdAt' | 'updatedAt'>): RMPolicy {
    const now = new Date().toISOString();
    const p: RMPolicy = { ...policy, id: generateId(), createdAt: now, updatedAt: now };
    this._policies.set(p.id, p);
    return p;
  }

  getPolicy(id: string): RMPolicy | undefined {
    return this._policies.get(id);
  }

  updatePolicy(id: string, updates: Partial<RMPolicy>): RMPolicy {
    const p = this._policies.get(id);
    if (!p) throw new Error(`RM policy not found: ${id}`);
    Object.assign(p, updates, { updatedAt: new Date().toISOString() });
    return p;
  }

  removePolicy(id: string): boolean {
    return this._policies.delete(id);
  }

  get allPolicies(): RMPolicy[] {
    return [...this._policies.values()];
  }

  // ── Stats ──

  getStats(): {
    sequences: number;
    activeSequences: number;
    totalMessages: number;
    pendingMessages: number;
    acknowledgedMessages: number;
    failedMessages: number;
    policies: number;
  } {
    const msgs = this._messages;
    return {
      sequences: this._sequences.size,
      activeSequences: [...this._sequences.values()].filter(s => s.state === 'active').length,
      totalMessages: msgs.length,
      pendingMessages: msgs.filter(m => m.status === 'sent').length,
      acknowledgedMessages: msgs.filter(m => m.status === 'acknowledged').length,
      failedMessages: msgs.filter(m => m.status === 'failed').length,
      policies: this._policies.size,
    };
  }

  // ── Events ──

  onAcknowledgment(cb: (ack: SequenceAcknowledgment) => void): void { this._onAck = cb; }
  onRetransmit(cb: (msg: ReliableMessage) => void): void { this._onRetransmit = cb; }
  onSequenceComplete(cb: (seq: ReliableSequence) => void): void { this._onSequenceComplete = cb; }
}
