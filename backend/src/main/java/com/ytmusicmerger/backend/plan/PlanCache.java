package com.ytmusicmerger.backend.plan;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * §5.8/§5.11 "Plan token / staleness rules" shared infrastructure: an in-memory,
 * single-use, TTL'd cache keyed by an opaque {@code planToken}. Used by both merge and
 * dedupe plan services (each owns its own instance - separate token namespaces, identical
 * semantics).
 *
 * <p>Single-use: {@link #take(String)} deletes the entry on lookup regardless of whether
 * the caller goes on to succeed or fail, so one preview yields at most one execute attempt.
 */
public final class PlanCache<T> {

    private final Duration ttl;
    private final Map<String, Entry<T>> store = new ConcurrentHashMap<>();

    public PlanCache(Duration ttl) {
        this.ttl = ttl;
    }

    public record PutResult(String token, Instant expiresAt) {
    }

    public PutResult put(T value) {
        evictExpired();
        String token = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plus(ttl);
        store.put(token, new Entry<>(value, expiresAt));
        return new PutResult(token, expiresAt);
    }

    /** Single-use lookup: removes the entry immediately. Empty if missing or expired. */
    public Optional<T> take(String token) {
        Entry<T> entry = store.remove(token);
        if (entry == null) {
            return Optional.empty();
        }
        if (Instant.now().isAfter(entry.expiresAt())) {
            return Optional.empty();
        }
        return Optional.of(entry.value());
    }

    private void evictExpired() {
        Instant now = Instant.now();
        store.values().removeIf(e -> now.isAfter(e.expiresAt()));
    }

    private record Entry<T>(T value, Instant expiresAt) {
    }
}
