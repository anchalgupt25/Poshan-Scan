import React from 'react';
import useStore from '../../store/useStore';
import StatusBar from '../shared/StatusBar';
import './onboarding.css';

/**
 * Allergen setup.
 *
 * Asks the yes/no question first and only then reveals the picker. Most
 * children have no allergies, and showing fifteen chips to those parents
 * invites mis-taps on the single most safety-critical field in the profile.
 *
 * The `id` values MUST match the allergen ontology in
 * backend/core/scoring/allergens.py — that's what maps "dairy" onto whey,
 * casein, ghee and the rest. Anything typed in the free-text box is still
 * checked, but with a literal match rather than ontology expansion.
 */
const ALLERGENS = [
  // US "Big 9" first — these cover the overwhelming majority of cases
  { id: 'dairy',     emoji: '🥛', label: 'Dairy',        note: 'milk, whey, casein, ghee' },
  { id: 'egg',       emoji: '🥚', label: 'Egg',          note: 'albumin, mayonnaise' },
  { id: 'peanut',    emoji: '🥜', label: 'Peanut',       note: 'groundnut, arachis' },
  { id: 'treenut',   emoji: '🌰', label: 'Tree nuts',    note: 'almond, cashew, walnut' },
  { id: 'wheat',     emoji: '🌾', label: 'Wheat/gluten', note: 'semolina, maida, atta' },
  { id: 'soy',       emoji: '🫘', label: 'Soy',          note: 'soya, tofu, lecithin' },
  { id: 'sesame',    emoji: '🌱', label: 'Sesame',       note: 'tahini, til' },
  { id: 'fish',      emoji: '🐟', label: 'Fish',         note: 'anchovy, cod, tuna' },
  { id: 'shellfish', emoji: '🦐', label: 'Shellfish',    note: 'shrimp, crab, prawn' },
  // Less common, still worth offering
  { id: 'mustard',   emoji: '🟡', label: 'Mustard',      note: 'sarson, dijon' },
  { id: 'celery',    emoji: '🥬', label: 'Celery',       note: 'celeriac' },
  { id: 'sulfite',   emoji: '🧪', label: 'Sulfites',     note: 'E220–E228' },
  { id: 'lupin',     emoji: '🌼', label: 'Lupin',        note: 'lupin flour' },
  { id: 'corn',      emoji: '🌽', label: 'Corn',         note: 'maize, corn syrup' },
  { id: 'coconut',   emoji: '🥥', label: 'Coconut',      note: 'copra, nariyal' },
];

export default function Onboard3() {
  const navigate = useStore((s) => s.navigate);
  const form = useStore((s) => s.onboardForm);
  const updateForm = useStore((s) => s.updateOnboardForm);
  const toggle = useStore((s) => s.toggleOnboardAllergen);

  // null = not answered yet, true/false = answered
  const hasAllergies = form.hasAllergies ?? null;
  const selected = form.allergies || [];

  const answerNo = () => {
    // Clear anything previously picked so a changed answer can't leave
    // stale allergens on the profile.
    updateForm({ hasAllergies: false, allergies: [], allergiesOther: '' });
  };

  const nothingPicked = selected.length === 0 && !(form.allergiesOther || '').trim();

  return (
    <div className="screen onboard-screen animate-fade-in">
      <StatusBar />
      <div className="onboard-header">
        <div className="onboard-progress">
          <span className="done" /><span className="done" /><span className="active" /><span />
        </div>
        <p className="onboard-step-label">Step 3 of 4 · Allergies</p>
        <div className="onboard-title">
          Does {form.name?.trim() || 'your child'} have any <em>food allergies</em>?
        </div>
        <div className="onboard-subtitle">
          We'll check every scan against these and flag a match at the top of the result.
        </div>
      </div>

      <div className="onboard-body">
        {/* ─── The yes/no gate ─── */}
        <div className="allergy-choice">
          <button
            type="button"
            className={`allergy-choice-btn ${hasAllergies === false ? 'selected' : ''}`}
            onClick={answerNo}
            aria-pressed={hasAllergies === false}
          >
            <span className="allergy-choice-icon">✓</span>
            <span className="allergy-choice-label">No known allergies</span>
          </button>
          <button
            type="button"
            className={`allergy-choice-btn ${hasAllergies === true ? 'selected' : ''}`}
            onClick={() => updateForm({ hasAllergies: true })}
            aria-pressed={hasAllergies === true}
          >
            <span className="allergy-choice-icon">⚠️</span>
            <span className="allergy-choice-label">Yes, let's add them</span>
          </button>
        </div>

        {/* ─── Picker, revealed only on "yes" ─── */}
        {hasAllergies === true && (
          <div className="allergy-picker animate-fade-in">
            <div className="section-label" style={{ marginTop: 22 }}>
              SELECT ALL THAT APPLY
            </div>

            <div className="allergen-grid">
              {ALLERGENS.map((a) => {
                const on = selected.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`allergen-card ${on ? 'selected' : ''}`}
                    onClick={() => toggle(a.id)}
                    aria-pressed={on}
                  >
                    <span className="allergen-card-emoji">{a.emoji}</span>
                    <span className="allergen-card-label">{a.label}</span>
                    <span className="allergen-card-note">{a.note}</span>
                    {on && <span className="allergen-card-check">✓</span>}
                  </button>
                );
              })}
            </div>

            <label className="onboard-label" htmlFor="other-allergens" style={{ marginTop: 20 }}>
              Anything else?
            </label>
            <input
              id="other-allergens"
              type="text"
              className="text-input"
              placeholder="kiwi, food colouring, strawberry…"
              value={form.allergiesOther || ''}
              onChange={(e) => updateForm({ allergiesOther: e.target.value })}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <p className="allergy-hint">
              Separate with commas. We match these by name on the ingredient list,
              so use the word that would actually appear on a label.
            </p>

            <div className="allergy-note">
              <strong>Always read the package too.</strong> We check ingredient lists and
              allergen data, but label information can be incomplete or out of date — and
              recipes change.
            </div>
          </div>
        )}
      </div>

      <div className="onboard-bottom">
        <button
          className="btn-primary"
          onClick={() => navigate('onboard4')}
          disabled={hasAllergies === null}
        >
          {hasAllergies === true && nothingPicked ? 'Skip for now' : 'Continue'}
        </button>
        {hasAllergies === null && (
          <p className="allergy-gate-hint">Pick one to continue</p>
        )}
      </div>
    </div>
  );
}
