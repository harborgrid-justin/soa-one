// ============================================================
// SOA One — Module Integration Service
// ============================================================
//
// Central wiring point that makes the Engine, ESB, CMS, and DI
// modules aware of each other. Creates singleton instances,
// registers cross-module plugins, and manages the lifecycle.
//
// Architecture:
//   ┌────────────┐
//   │ RuleEngine │◄── ESB + CMS + DI + Bridge Plugins
//   └────┬───────┘
//        │
//   ┌────┴──────────────────────┐
//   │            │              │
//   ▼            ▼              ▼
// ServiceBus   CMS     DataIntegrator
//   │            │              │
//   └──── Bridge (tri-directional) ─┘
// ============================================================

import { RuleEngine } from '@soa-one/engine';
import type { EnginePlugin } from '@soa-one/engine';
import { ServiceBus, createESBPlugin } from '@soa-one/esb';
import { ContentManagementSystem, createCMSPlugin } from '@soa-one/cms';
import { DataIntegrator, createDIPlugin } from '@soa-one/di';
import { createBridgePlugin, setupEventBridge } from './bridge';

// ── Singleton Instances ─────────────────────────────────────

let _bus: ServiceBus | null = null;
let _cms: ContentManagementSystem | null = null;
let _di: DataIntegrator | null = null;
let _engine: RuleEngine | null = null;
let _initialized = false;

// ── Public Accessors ────────────────────────────────────────

/** Get the shared ServiceBus instance. */
export function getBus(): ServiceBus {
  if (!_bus) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _bus;
}

/** Get the shared ContentManagementSystem instance. */
export function getCMS(): ContentManagementSystem {
  if (!_cms) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _cms;
}

/** Get the shared DataIntegrator instance. */
export function getDI(): DataIntegrator {
  if (!_di) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _di;
}

/** Get the shared RuleEngine with ESB + CMS + DI plugins registered. */
export function getEngine(): RuleEngine {
  if (!_engine) throw new Error('Integration not initialized. Call initIntegration() first.');
  return _engine;
}

/** Check if the integration layer is initialized. */
export function isIntegrationReady(): boolean {
  return _initialized;
}

// ── Lifecycle ───────────────────────────────────────────────

/**
 * Initialize all four modules and wire them together.
 *
 * 1. Creates ServiceBus, ContentManagementSystem, DataIntegrator, RuleEngine
 * 2. Registers ESB, CMS, and DI plugins with the engine
 * 3. Registers the bridge plugin for cross-module functions
 * 4. Sets up tri-directional event forwarding between ESB, CMS, and DI
 */
export async function initIntegration(): Promise<void> {
  if (_initialized) return;

  console.log('[integration] Initializing cross-module integration...');

  // 1. Create module instances
  _bus = new ServiceBus({
    name: 'soa-one-esb',
    metricsEnabled: true,
    metadata: { source: 'soa-one-server' },
  });

  _cms = new ContentManagementSystem({
    name: 'soa-one-cms',
    auditEnabled: true,
    fullTextIndexEnabled: true,
    metadata: { source: 'soa-one-server' },
  });

  _di = new DataIntegrator({
    name: 'soa-one-di',
    auditEnabled: true,
  });

  // 2. Initialize modules
  await _bus.init();
  await _cms.init();
  await _di.init();
  console.log('[integration] ESB, CMS, and DI initialized');

  // 3. Create the ESB integration channels
  _bus.createChannel({ name: 'cms.events', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'esb.events', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'cms.documents', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'cms.workflows', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'di.events', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'di.pipelines', type: 'publish-subscribe' });
  _bus.createChannel({ name: 'di.cdc', type: 'publish-subscribe' });

  // 4. Create engine with all plugins + bridge plugin
  const plugins: EnginePlugin[] = [
    createESBPlugin(_bus),
    createCMSPlugin(_cms),
    createDIPlugin(_di),
    createBridgePlugin(_bus, _cms, _di),
  ];

  _engine = new RuleEngine({ plugins });
  await _engine.init();
  console.log('[integration] RuleEngine initialized with ESB, CMS, DI, and Bridge plugins');

  // 5. Set up tri-directional event bridge
  setupEventBridge(_bus, _cms, _di);
  console.log('[integration] ESB ⇄ CMS ⇄ DI event bridge active');

  _initialized = true;
  console.log('[integration] Cross-module integration ready');
}

/**
 * Gracefully shut down all modules in reverse order.
 */
export async function shutdownIntegration(): Promise<void> {
  if (!_initialized) return;

  console.log('[integration] Shutting down cross-module integration...');

  if (_engine) {
    await _engine.shutdown();
    _engine = null;
  }

  if (_di) {
    await _di.shutdown();
    _di = null;
  }

  if (_cms) {
    await _cms.shutdown();
    _cms = null;
  }

  if (_bus) {
    await _bus.shutdown();
    _bus = null;
  }

  _initialized = false;
  console.log('[integration] Integration shutdown complete');
}
