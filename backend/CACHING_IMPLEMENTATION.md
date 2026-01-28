# Redis Caching Implementation

## Overview

This document describes the Redis caching layer implemented for the Stellar Insights backend. The caching system reduces database load and improves API response times through intelligent cache management with automatic fallback to memory-based caching.

## Architecture

### Components

1. **RedisCache** (`src/cache/redis_cache.rs`)
   - Main cache abstraction layer
   - Supports both Redis and memory-based fallback
   - Automatic connection management
   - Graceful degradation when Redis is unavailable

2. **CacheKey** (`src/cache/cache_keys.rs`)
   - Centralized cache key generation
   - Consistent naming patterns for all cached data
   - Pattern-based invalidation support

3. **CacheMetrics** (`src/cache/metrics.rs`)
   - Real-time cache performance monitoring
   - Hit/miss/error tracking
   - Hit rate calculation

4. **CacheInvalidationService** (`src/services/cache_invalidation.rs`)
   - Handles cache invalidation on data mutations
   - Event-based invalidation triggers
   - Pattern-based bulk invalidation

5. **Cached Handlers** (`src/api/cached_handlers.rs`)
   - Cache-aware API endpoint implementations
   - Cache-aside pattern implementation
   - Automatic cache invalidation on mutations

## Caching Strategy

### Cache-Aside Pattern

All cached endpoints follow the cache-aside pattern:

```
1. Check cache for key
2. If hit: return cached value
3. If miss: fetch from database
4. Store in cache with TTL
5. Return value
```

### TTL Configuration

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Corridor Metrics | 5 minutes | Matches ingestion interval, frequently accessed |
| Anchor Data | 10 minutes | Relatively stable, moderate access frequency |
| Dashboard Stats | 1 minute | Highly volatile, high access frequency |

### Cache Invalidation Strategy

**Event-Based Invalidation:**
- On anchor creation/update: Invalidate anchor list and detail caches
- On corridor creation/update: Invalidate corridor list and detail caches
- On metrics ingestion: Invalidate all corridor and dashboard caches
- On metrics update: Invalidate specific anchor/corridor caches

**Pattern-Based Invalidation:**
- `anchor:*` - All anchor-related caches
- `corridor:*` - All corridor-related caches
- `dashboard:*` - All dashboard-related caches

## Cached Endpoints

### Anchor Endpoints

#### GET /api/anchors
- **Cache Key**: `anchor:list:{limit}:{offset}`
- **TTL**: 10 minutes
- **Handler**: `list_anchors_cached`
- **Invalidation**: On anchor creation/update

#### GET /api/anchors/:id
- **Cache Key**: `anchor:detail:{id}`
- **TTL**: 10 minutes
- **Handler**: `get_anchor_cached`
- **Invalidation**: On anchor metrics update

#### GET /api/anchors/account/:stellar_account
- **Cache Key**: `anchor:account:{stellar_account}`
- **TTL**: 10 minutes
- **Handler**: `get_anchor_by_account_cached`
- **Invalidation**: On anchor update

#### GET /api/anchors/:id/assets
- **Cache Key**: `anchor:assets:{id}`
- **TTL**: 10 minutes
- **Handler**: `get_anchor_assets_cached`
- **Invalidation**: On asset creation

#### POST /api/anchors
- **Invalidation**: Clears `anchor:*` pattern
- **Handler**: `create_anchor_cached`

#### PUT /api/anchors/:id/metrics
- **Invalidation**: Clears `anchor:*` and `dashboard:*` patterns
- **Handler**: `update_anchor_metrics_cached`

#### POST /api/anchors/:id/assets
- **Invalidation**: Clears anchor detail and assets caches
- **Handler**: `create_anchor_asset_cached`

### Corridor Endpoints

#### GET /api/corridors
- **Cache Key**: `corridor:list:{limit}:{offset}:{filters_hash}`
- **TTL**: 5 minutes
- **Handler**: `list_corridors_cached`
- **Invalidation**: On corridor creation/update

#### POST /api/corridors
- **Invalidation**: Clears `corridor:*` pattern
- **Handler**: `create_corridor_cached`

### Cache Management Endpoints

#### GET /api/cache/stats
- **Returns**: Cache hit rate, total hits/misses/errors, Redis connection status
- **Handler**: `get_cache_stats`
- **No Cache**: Real-time metrics

#### PUT /api/cache/clear
- **Effect**: Clears all cache entries
- **Handler**: `clear_cache`
- **Use Case**: Admin operations, cache refresh

## Configuration

### Environment Variables

```bash
# Redis connection (optional, falls back to memory cache)
REDIS_URL=redis://127.0.0.1:6379

# Database URL
DATABASE_URL=sqlite:stellar_insights.db

# Server configuration
SERVER_HOST=127.0.0.1
SERVER_PORT=8080
```

### Default Behavior

- If `REDIS_URL` is not set: Uses `redis://127.0.0.1:6379`
- If Redis connection fails: Automatically falls back to memory cache
- Memory cache entries expire based on TTL
- No data loss on Redis unavailability

## Performance Metrics

### Expected Improvements

| Endpoint | Before Cache | After Cache | Improvement |
|----------|--------------|-------------|-------------|
| GET /api/anchors | 200-500ms | 20-50ms | 5-10x faster |
| GET /api/anchors/:id | 100-300ms | 20-60ms | 3-5x faster |
| GET /api/corridors | 300-800ms | 30-100ms | 5-8x faster |
| Dashboard load | 1-2s | 300-500ms | 2-3x faster |

### Cache Hit Rate Targets

- Anchor list: 70-80% hit rate
- Anchor detail: 60-70% hit rate
- Corridor list: 80-90% hit rate
- Dashboard stats: 90%+ hit rate

## Monitoring

### Cache Metrics Endpoint

```bash
curl http://localhost:8080/api/cache/stats
```

Response:
```json
{
  "redis_connected": true,
  "metrics": {
    "hits": 1250,
    "misses": 180,
    "errors": 5,
    "invalidations": 42,
    "hit_rate": 87.41
  }
}
```

### Logging

Cache operations are logged at DEBUG level:
- Cache hits: `Cache hit (Redis): {key}`
- Cache misses: `Cache miss: {key}`
- Cache sets: `Cache set (Redis): {key} (TTL: {ttl}s)`
- Invalidations: `Cache deleted (Redis): {key}`

Enable debug logging:
```bash
RUST_LOG=backend=debug cargo run
```

## Fallback Behavior

### Redis Unavailable

1. **Connection Failure**: Automatically falls back to memory cache
2. **Set Operation Failure**: Stores in memory cache instead
3. **Get Operation**: Checks memory cache if Redis fails
4. **Reconnection**: Can be triggered via `cache.reconnect()` or automatically on next operation

### Memory Cache

- In-process HashMap with TTL tracking
- Automatic expiration on access
- No persistence across restarts
- Suitable for single-instance deployments

## Best Practices

### 1. Cache Key Naming

Always use `CacheKey` helper methods:
```rust
let key = CacheKey::anchor_list(limit, offset);
```

### 2. TTL Selection

- Short TTL (1-5 min): Frequently changing data
- Medium TTL (5-15 min): Moderately stable data
- Long TTL (30+ min): Rarely changing data

### 3. Invalidation

Always invalidate related caches on mutations:
```rust
// After updating anchor
cache.delete_pattern(&CacheKey::anchor_pattern()).await?;
cache.delete_pattern(&CacheKey::dashboard_pattern()).await?;
```

### 4. Error Handling

Cache failures should not break the application:
```rust
if let Err(e) = cache.set(&key, &value, TTL).await {
    warn!("Failed to cache: {}", e);
    // Continue without caching
}
```

### 5. Monitoring

Regularly check cache metrics:
```bash
# Monitor hit rate
watch -n 5 'curl -s http://localhost:8080/api/cache/stats | jq .metrics.hit_rate'
```

## Testing

### Unit Tests

Run cache tests:
```bash
cargo test cache --lib
```

### Integration Testing

1. Start Redis:
```bash
docker run -d -p 6379:6379 redis:latest
```

2. Run with caching:
```bash
REDIS_URL=redis://127.0.0.1:6379 cargo run
```

3. Test endpoints:
```bash
# First request (cache miss)
time curl http://localhost:8080/api/anchors

# Second request (cache hit)
time curl http://localhost:8080/api/anchors
```

## Troubleshooting

### High Cache Miss Rate

**Symptoms**: Hit rate < 50%

**Causes**:
- TTL too short
- Cache keys not consistent
- Frequent data mutations

**Solutions**:
- Increase TTL for stable data
- Review cache key generation
- Check invalidation logic

### Memory Cache Growing

**Symptoms**: High memory usage

**Causes**:
- Redis unavailable for long time
- Memory cache not expiring entries
- Too many unique cache keys

**Solutions**:
- Restart application
- Check Redis connection
- Review cache key patterns

### Redis Connection Issues

**Symptoms**: "Failed to connect to Redis"

**Causes**:
- Redis not running
- Wrong REDIS_URL
- Network connectivity

**Solutions**:
```bash
# Check Redis is running
redis-cli ping

# Verify connection string
echo $REDIS_URL

# Test connection
redis-cli -u $REDIS_URL ping
```

## Future Enhancements

1. **Cache Warming**: Pre-populate cache on startup
2. **Distributed Invalidation**: Invalidate cache across multiple instances
3. **Cache Compression**: Compress large cached values
4. **Adaptive TTL**: Adjust TTL based on hit rate
5. **Cache Partitioning**: Separate caches for different data types
6. **Metrics Export**: Prometheus metrics integration

## References

- [Redis Documentation](https://redis.io/documentation)
- [Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Rust Redis Client](https://github.com/redis-rs/redis-rs)
