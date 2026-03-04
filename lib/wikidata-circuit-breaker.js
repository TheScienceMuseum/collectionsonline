'use strict';

/**
 * Simple hand-rolled circuit breaker for Wikidata API calls.
 *
 * States:
 *   closed   – normal operation; requests pass through
 *   open     – failure threshold exceeded; requests are rejected immediately
 *   half-open – after resetTimeout, one probe request is allowed through;
 *               success → closed, failure → open again
 *
 * Config:
 *   threshold    – consecutive failures before opening (default: 5)
 *   resetTimeout – ms to wait in open state before moving to half-open (default: 30000)
 */

const CLOSED = 'closed';
const OPEN = 'open';
const HALF_OPEN = 'half-open';

class CircuitBreaker {
  constructor ({ threshold = 5, resetTimeout = 30000 } = {}) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
    this.state = CLOSED;
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }

  /**
   * Wrap an async function with circuit-breaker protection.
   * @param {Function} fn – async function to call
   * @returns {Promise} resolves with fn's result, or rejects if circuit is open
   */
  async call (fn) {
    if (this.state === OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker open — Wikidata requests suspended');
      }
      // Transition to half-open: allow one probe request
      this.state = HALF_OPEN;
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess () {
    this.failureCount = 0;
    this.state = CLOSED;
  }

  _onFailure () {
    this.failureCount += 1;
    if (this.state === HALF_OPEN || this.failureCount >= this.threshold) {
      this.state = OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.error(
        `[wikidata-circuit-breaker] Circuit opened after ${this.failureCount} failure(s). ` +
        `Resuming probe in ${this.resetTimeout / 1000}s.`
      );
    }
  }

  get isOpen () {
    return this.state === OPEN && Date.now() < this.nextAttempt;
  }
}

// Export a singleton instance used by routes/wiki.js
module.exports = new CircuitBreaker({ threshold: 5, resetTimeout: 30000 });
