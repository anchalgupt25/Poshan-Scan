import React from 'react';

/**
 * Allergen alert banner.
 *
 * Sits above the score, because for a parent with an allergic child this is
 * the only thing on the page that matters — a Grade A product containing
 * their child's allergen is still the wrong answer.
 *
 * "Contains" and "may contain" are visually distinct on purpose. Collapsing
 * a cross-contamination advisory into a definite warning would train parents
 * to ignore both.
 */
export default function AllergenBanner({ alerts = [], childName = 'your child' }) {
  if (!alerts.length) return null;

  const definite = alerts.filter((a) => a.certainty === 'contains');
  const advisory = alerts.filter((a) => a.certainty !== 'contains');

  return (
    <div className={`allergen-banner ${definite.length ? 'is-definite' : 'is-advisory'}`}
         role="alert">
      <div className="allergen-banner-head">
        <span className="allergen-banner-icon" aria-hidden>
          {definite.length ? '⛔' : '⚠️'}
        </span>
        <div>
          <div className="allergen-banner-title">
            {definite.length > 0 ? (
              <>Contains {childName}'s {definite.length > 1 ? 'allergens' : 'allergen'}</>
            ) : (
              <>May contain {childName}'s {advisory.length > 1 ? 'allergens' : 'allergen'}</>
            )}
          </div>
          <div className="allergen-banner-sub">
            {definite.length > 0
              ? 'Do not serve without checking the package yourself.'
              : 'Cross-contamination warning on the label.'}
          </div>
        </div>
      </div>

      {definite.length > 0 && (
        <div className="allergen-chip-row">
          {definite.map((a) => (
            <span key={a.allergen_id} className="allergen-chip definite">
              {a.label}
              {a.matched_terms?.length > 0 && (
                <span className="allergen-chip-terms">
                  {' '}· {a.matched_terms.slice(0, 2).join(', ')}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {advisory.length > 0 && (
        <div className="allergen-advisory">
          <strong>May contain:</strong>{' '}
          {advisory.map((a) => a.label).join(', ')}
          {' '}— shared equipment or facility.
        </div>
      )}

      <div className="allergen-banner-foot">
        Always read the package. Ingredient data can be incomplete or out of date,
        and recipes change without notice.
      </div>
    </div>
  );
}
