/**
 * ============================================================================
 * Supabase PostgREST `.or()` filter escaping helpers
 * ============================================================================
 *
 * PostgREST filter syntax (used by `supabase.from(...).or('...')`) has the
 * following metacharacters that break parsing or change semantics when
 * untrusted input is interpolated into a filter string:
 *
 *   - `,`     separates filter clauses inside `.or(...)`
 *   - `(` `)` are reserved for grouping and operator wrappers
 *   - `*`     is the wildcard for `like` / `ilike` patterns
 *   - `%` `_` are SQL LIKE wildcards
 *   - `\`     is the escape character
 *
 * Without escaping, a value like `foo,bar.eq.x` injected into `.or(...)`
 * effectively appends an attacker-controlled clause. A value containing `*`
 * or `%` can turn an exact-match style filter into a wildcard scan.
 *
 * Strategy: drop disallowed PostgREST metacharacters and escape SQL LIKE
 * wildcards so they match literally. Length capping is the caller's job.
 *
 * Use `escapeOrFilterLiteral` for values matched literally (e.g. `eq`, `is`,
 * or fixed `ilike` segments where wildcards from input must be neutralized).
 *
 * Use `escapeIlikePattern` for values that will be wrapped between `*` so
 * they become substring matches; the caller adds the surrounding `*`.
 *
 * Examples:
 *   escapeOrFilterLiteral('Smith, John')   -> 'Smith John'
 *   escapeOrFilterLiteral('100%')          -> '100\\%'
 *   escapeOrFilterLiteral('a(b)c')         -> 'abc'
 *   escapeIlikePattern('foo*bar')          -> 'foobar'
 *   escapeIlikePattern('50%_off')          -> '50\\%\\_off'
 *   escapeIlikePattern('a,b(c)')           -> 'abc'
 *
 * Both helpers return strings; if the result is empty the caller should
 * decide whether to skip the query entirely (recommended for search APIs).
 * ============================================================================
 */

/**
 * Escapes a value for safe inclusion in a PostgREST `.or()` filter where the
 * value should match literally (no wildcard semantics). SQL LIKE wildcards
 * (`%` and `_`) are escaped, the backslash is escaped, and PostgREST
 * metacharacters (`,`, `(`, `)`, `*`) are dropped.
 */
export function escapeOrFilterLiteral(input: string): string {
  return input
    .replace(/\\/g, '\\\\') // escape backslash first
    .replace(/[%_]/g, (m) => '\\' + m) // escape SQL LIKE wildcards
    .replace(/[,()*]/g, '') // drop PostgREST metacharacters
}

/**
 * Escapes a value to be used inside an `ilike.*<value>*` pattern. Wildcards
 * `%` and `_` from user input are escaped so they match literally; PostgREST
 * metacharacters (`,`, `(`, `)`, `*`) are dropped. The caller is responsible
 * for wrapping the result with `*` on each side and capping the length.
 */
export function escapeIlikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\') // escape backslash first
    .replace(/[%_]/g, (m) => '\\' + m) // escape SQL LIKE wildcards
    .replace(/[,()*]/g, '') // drop PostgREST metacharacters
}
