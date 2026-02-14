// ============================================================
// SOA One ESB — Message Router
// ============================================================
//
// Content-based, header-based, priority-based, round-robin,
// weighted, failover, multicast, dynamic, itinerary, and
// recipient-list routing strategies.
//
// Goes beyond Oracle ESB with:
// - Dynamic routing with runtime route registration
// - Itinerary-based routing (routing slip pattern)
// - Recipient-list routing with computed destinations
// - Multicast with parallel delivery
// - Route versioning and hot-swap
// - Weighted routing with adjustable weights
// ============================================================

import type {
  ESBMessage,
  Route,
  RoutingTable,
  RoutingStrategy,
  RoutingCondition,
  RoutingConditionGroup,
  RoutingSlipEntry,
} from './types';
import { resolvePath, evaluateRoutingOperator, generateId } from './channel';

// ── Route Evaluation Result ───────────────────────────────────

/** Result of evaluating a message against the routing table. */
export interface RouteMatch {
  /** The matched route. */
  route: Route;
  /** The resolved destination(s). */
  destinations: string[];
  /** Whether the match was based on condition evaluation. */
  conditionMatched: boolean;
}

// ── Message Router ────────────────────────────────────────────

/**
 * Evaluates messages against a routing table and returns
 * matching destinations. Supports all routing strategies.
 *
 * This is a pure routing engine — it determines WHERE a message
 * should go but does not handle the actual delivery (that's the
 * ServiceBus's responsibility).
 */
export class MessageRouter {
  private _routingTable: RoutingTable;
  private _roundRobinCounters: Map<string, number> = new Map();

  constructor(routingTable?: RoutingTable) {
    this._routingTable = routingTable ?? {
      routes: [],
      strategy: 'content-based',
    };
  }

  // ── Route Management ────────────────────────────────────

  /** Add a route to the routing table. */
  addRoute(route: Route): void {
    // Check for duplicate IDs
    if (this._routingTable.routes.some((r) => r.id === route.id)) {
      throw new Error(`Route "${route.id}" already exists.`);
    }
    this._routingTable.routes.push(route);
    // Re-sort by priority (higher first)
    this._routingTable.routes.sort((a, b) => b.priority - a.priority);
  }

  /** Remove a route by ID. */
  removeRoute(routeId: string): boolean {
    const idx = this._routingTable.routes.findIndex((r) => r.id === routeId);
    if (idx >= 0) {
      this._routingTable.routes.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Update an existing route. */
  updateRoute(routeId: string, updates: Partial<Route>): boolean {
    const route = this._routingTable.routes.find((r) => r.id === routeId);
    if (!route) return false;
    Object.assign(route, updates);
    this._routingTable.routes.sort((a, b) => b.priority - a.priority);
    return true;
  }

  /** Get a route by ID. */
  getRoute(routeId: string): Route | undefined {
    return this._routingTable.routes.find((r) => r.id === routeId);
  }

  /** Get all routes. */
  get routes(): Route[] {
    return [...this._routingTable.routes];
  }

  /** Set the default routing strategy. */
  set strategy(strategy: RoutingStrategy) {
    this._routingTable.strategy = strategy;
  }

  /** Set the default destination. */
  set defaultDestination(dest: string | undefined) {
    this._routingTable.defaultDestination = dest;
  }

  // ── Route Evaluation ───────────────────────────────────

  /**
   * Evaluate a message and determine matching routes.
   * Returns all matching RouteMatch results.
   */
  evaluate(message: ESBMessage): RouteMatch[] {
    const strategy = this._routingTable.strategy;
    const enabledRoutes = this._routingTable.routes.filter((r) => r.enabled);

    switch (strategy) {
      case 'content-based':
        return this._evaluateContentBased(message, enabledRoutes);
      case 'header-based':
        return this._evaluateHeaderBased(message, enabledRoutes);
      case 'priority-based':
        return this._evaluatePriorityBased(message, enabledRoutes);
      case 'round-robin':
        return this._evaluateRoundRobin(message, enabledRoutes);
      case 'weighted':
        return this._evaluateWeighted(message, enabledRoutes);
      case 'failover':
        return this._evaluateFailover(message, enabledRoutes);
      case 'multicast':
        return this._evaluateMulticast(message, enabledRoutes);
      case 'dynamic':
        return this._evaluateDynamic(message, enabledRoutes);
      case 'itinerary':
        return this._evaluateItinerary(message, enabledRoutes);
      case 'recipient-list':
        return this._evaluateRecipientList(message, enabledRoutes);
      default:
        return this._evaluateContentBased(message, enabledRoutes);
    }
  }

  /**
   * Resolve the final destination(s) for a message.
   * Convenience method that returns just the destination strings.
   */
  resolve(message: ESBMessage): string[] {
    const matches = this.evaluate(message);
    if (matches.length === 0 && this._routingTable.defaultDestination) {
      return [this._routingTable.defaultDestination];
    }
    const destinations = new Set<string>();
    for (const match of matches) {
      for (const dest of match.destinations) {
        destinations.add(dest);
      }
    }
    return Array.from(destinations);
  }

  // ── Strategy Implementations ────────────────────────────

  /** Content-based: match conditions against message body. */
  private _evaluateContentBased(
    message: ESBMessage,
    routes: Route[],
  ): RouteMatch[] {
    const matches: RouteMatch[] = [];
    for (const route of routes) {
      if (!route.condition) {
        matches.push({
          route,
          destinations: route.destinations,
          conditionMatched: false,
        });
        continue;
      }
      if (this._evaluateCondition(message, route.condition)) {
        matches.push({
          route,
          destinations: route.destinations,
          conditionMatched: true,
        });
      }
    }
    return matches;
  }

  /** Header-based: match conditions against message headers. */
  private _evaluateHeaderBased(
    message: ESBMessage,
    routes: Route[],
  ): RouteMatch[] {
    // Force all conditions to use 'headers' source
    const matches: RouteMatch[] = [];
    for (const route of routes) {
      if (!route.condition) {
        matches.push({
          route,
          destinations: route.destinations,
          conditionMatched: false,
        });
        continue;
      }
      // Override source to headers for this strategy
      const headerCondition = this._overrideSource(route.condition, 'headers');
      if (this._evaluateCondition(message, headerCondition)) {
        matches.push({
          route,
          destinations: route.destinations,
          conditionMatched: true,
        });
      }
    }
    return matches;
  }

  /** Priority-based: return the first (highest priority) matching route. */
  private _evaluatePriorityBased(
    message: ESBMessage,
    routes: Route[],
  ): RouteMatch[] {
    // Routes are already sorted by priority
    for (const route of routes) {
      if (!route.condition || this._evaluateCondition(message, route.condition)) {
        return [{
          route,
          destinations: route.destinations,
          conditionMatched: !!route.condition,
        }];
      }
    }
    return [];
  }

  /** Round-robin: distribute messages across routes in order. */
  private _evaluateRoundRobin(
    _message: ESBMessage,
    routes: Route[],
  ): RouteMatch[] {
    if (routes.length === 0) return [];

    const key = 'round-robin';
    const counter = this._roundRobinCounters.get(key) ?? 0;
    const idx = counter % routes.length;
    this._roundRobinCounters.set(key, counter + 1);

    const route = routes[idx];
    return [{
      route,
      destinations: route.destinations,
      conditionMatched: false,
    }];
  }

  /** Weighted: select a route based on weighted random selection. */
  private _evaluateWeighted(
    _message: ESBMessage,
    routes: Route[],
  ): RouteMatch[] {
    if (routes.length === 0) return [];

    const totalWeight = routes.reduce((sum, r) => sum + r.priority, 0);
    let random = Math.random() * totalWeight;

    for (const route of routes) {
      random -= route.priority;
      if (random <= 0) {
        return [{
          route,
          destinations: route.destinations,
          conditionMatched: false,
        }];
      }
    }

    // Fallback to last route
    const last = routes[routes.length - 1];
    return [{
      route: last,
      destinations: last.destinations,
      conditionMatched: false,
    }];
  }

  /** Failover: try routes in order, return first available. */
  private _evaluateFailover(
    _message: ESBMessage,
    routes: Route[],
  ): RouteMatch[] {
    // Return the first route (highest priority) as primary
    if (routes.length > 0) {
      return [{
        route: routes[0],
        destinations: routes[0].destinations,
        conditionMatched: false,
      }];
    }
    return [];
  }

  /** Multicast: send to ALL matching routes. */
  private _evaluateMulticast(
    message: ESBMessage,
    routes: Route[],
  ): RouteMatch[] {
    const matches: RouteMatch[] = [];
    for (const route of routes) {
      if (!route.condition || this._evaluateCondition(message, route.condition)) {
        matches.push({
          route,
          destinations: route.destinations,
          conditionMatched: !!route.condition,
        });
      }
    }
    return matches;
  }

  /** Dynamic: evaluate conditions and dynamically compute destinations. */
  private _evaluateDynamic(
    message: ESBMessage,
    routes: Route[],
  ): RouteMatch[] {
    return this._evaluateContentBased(message, routes);
  }

  /** Itinerary: use routing slip from message metadata. */
  private _evaluateItinerary(
    message: ESBMessage,
    routes: Route[],
  ): RouteMatch[] {
    const slip: RoutingSlipEntry[] = message.metadata?.routingSlip;
    if (!slip || !Array.isArray(slip)) {
      // Fall back to content-based if no routing slip
      return this._evaluateContentBased(message, routes);
    }

    // Find the next uncompleted step in the routing slip
    const nextStep = slip.find((entry) => !entry.completed);
    if (!nextStep) return [];

    // Find a route that matches the itinerary destination
    const route = routes.find((r) => r.destinations.includes(nextStep.destination));
    if (route) {
      return [{
        route,
        destinations: [nextStep.destination],
        conditionMatched: false,
      }];
    }

    // If no route exists, create an ad-hoc route
    return [{
      route: {
        id: `itinerary-${generateId()}`,
        name: `Itinerary step: ${nextStep.destination}`,
        source: '',
        destinations: [nextStep.destination],
        priority: 0,
        enabled: true,
      },
      destinations: [nextStep.destination],
      conditionMatched: false,
    }];
  }

  /** Recipient-list: derive destinations from message content. */
  private _evaluateRecipientList(
    message: ESBMessage,
    routes: Route[],
  ): RouteMatch[] {
    // Check for explicit recipient list in metadata
    const recipients: string[] = message.metadata?.recipients;
    if (recipients && Array.isArray(recipients)) {
      const matchedRoutes = routes.filter((r) =>
        r.destinations.some((d) => recipients.includes(d)),
      );
      if (matchedRoutes.length > 0) {
        return matchedRoutes.map((route) => ({
          route,
          destinations: route.destinations.filter((d) => recipients.includes(d)),
          conditionMatched: false,
        }));
      }
      // Ad-hoc route for explicit recipients
      return [{
        route: {
          id: `recipient-list-${generateId()}`,
          name: 'Recipient list',
          source: '',
          destinations: recipients,
          priority: 0,
          enabled: true,
        },
        destinations: recipients,
        conditionMatched: false,
      }];
    }

    // Fall back to content-based
    return this._evaluateContentBased(message, routes);
  }

  // ── Condition Evaluation ────────────────────────────────

  private _evaluateCondition(
    message: ESBMessage,
    condition: RoutingCondition | RoutingConditionGroup,
  ): boolean {
    if ('logic' in condition) {
      return this._evaluateConditionGroup(message, condition as RoutingConditionGroup);
    }
    return this._evaluateSingleCondition(message, condition as RoutingCondition);
  }

  private _evaluateConditionGroup(
    message: ESBMessage,
    group: RoutingConditionGroup,
  ): boolean {
    if (!group.conditions || group.conditions.length === 0) return true;

    if (group.logic === 'AND') {
      return group.conditions.every((c) => this._evaluateCondition(message, c));
    }
    return group.conditions.some((c) => this._evaluateCondition(message, c));
  }

  private _evaluateSingleCondition(
    message: ESBMessage,
    condition: RoutingCondition,
  ): boolean {
    let fieldValue: any;
    switch (condition.source) {
      case 'headers':
        fieldValue = resolvePath(message.headers, condition.field);
        break;
      case 'metadata':
        fieldValue = resolvePath(message.metadata, condition.field);
        break;
      default:
        fieldValue = resolvePath(message.body, condition.field);
        break;
    }
    return evaluateRoutingOperator(fieldValue, condition.operator, condition.value);
  }

  private _overrideSource(
    condition: RoutingCondition | RoutingConditionGroup,
    source: 'body' | 'headers' | 'metadata',
  ): RoutingCondition | RoutingConditionGroup {
    if ('logic' in condition) {
      const group = condition as RoutingConditionGroup;
      return {
        logic: group.logic,
        conditions: group.conditions.map((c) => this._overrideSource(c, source)),
      };
    }
    return { ...(condition as RoutingCondition), source };
  }
}
