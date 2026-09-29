/* ============================================================
   TELOS · GuidePage, refonte complète
   Structure : questions que se pose l'investisseur débutant,
   pas la logique d'un cours magistral.
   ============================================================ */

import React, { useState } from 'react';

// ── Composants utilitaires ───────────────────────────────────

function Q({ children }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--accent)',
      marginBottom: 8,
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%',
        background: 'oklch(0.82 0.11 78 / 0.12)',
        border: '1px solid oklch(0.82 0.11 78 / 0.3)',
        display: 'grid', placeItems: 'center',
        fontSize: 11, fontWeight: 700,
      }}>?</span>
      {children}
    </div>
  );
}

function Callout({ type = 'info', label, children }) {
  const colors = {
    info:    { border: 'var(--accent)',    bg: 'oklch(0.82 0.11 78 / 0.05)',  labelColor: 'var(--accent)' },
    warn:    { border: 'var(--warn)',      bg: 'oklch(0.80 0.13 65 / 0.05)',  labelColor: 'var(--warn)' },
    success: { border: 'var(--pos)',       bg: 'oklch(0.78 0.13 150 / 0.05)', labelColor: 'var(--pos)' },
    danger:  { border: 'var(--neg)',       bg: 'oklch(0.72 0.16 28 / 0.05)',  labelColor: 'var(--neg)' },
  };
  const c = colors[type] || colors.info;
  return (
    <div style={{
      margin: '20px 0', padding: '14px 18px',
      background: c.bg,
      borderLeft: `2px solid ${c.border}`,
      borderRadius: '0 var(--r-md) var(--r-md) 0',
    }}>
      {label && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: c.labelColor, marginBottom: 6,
        }}>{label}</div>
      )}
      <div style={{ fontSize: 13.5, color: 'var(--fg-1)', lineHeight: 1.65 }}>
        {children}
      </div>
    </div>
  );
}

function Chiffre({ valeur, label, sub, color }) {
  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--bg-1)',
      border: '1px solid var(--line-1)',
      borderRadius: 'var(--r-lg)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600,
        color: color || 'var(--fg-0)', letterSpacing: '-0.02em',
        lineHeight: 1.1,
      }}>{valeur}</div>
      <div style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{sub}</div>}
    </div>
  );
}

function Comparaison({ gauche, droite }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', margin: '20px 0' }}>
      <div style={{
        padding: '16px', background: 'var(--bg-1)', border: '1px solid var(--line-1)',
        borderRadius: 'var(--r-lg)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{gauche.label}</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: gauche.color || 'var(--fg-0)', fontFamily: 'var(--font-mono)' }}>{gauche.valeur}</div>
        {gauche.sub && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>{gauche.sub}</div>}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--fg-3)' }}>vs</div>
      <div style={{
        padding: '16px', background: 'var(--bg-1)', border: '1px solid var(--line-1)',
        borderRadius: 'var(--r-lg)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{droite.label}</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: droite.color || 'var(--fg-0)', fontFamily: 'var(--font-mono)' }}>{droite.valeur}</div>
        {droite.sub && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>{droite.sub}</div>}
      </div>
    </div>
  );
}

function BarChart({ data, max, unit = '€' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--fg-2)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{d.label}</div>
          <div style={{ height: 24, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${(d.valeur / max) * 100}%`,
              background: d.color || 'var(--accent)',
              borderRadius: 4,
              transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: d.color || 'var(--fg-0)', fontWeight: 600 }}>
            {d.valeur.toLocaleString('fr-FR')} {unit}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Simulateur interactif intégré ────────────────────────────

function SimulateurCompound() {
  const [montant, setMontant] = useState(200);
  const [annees, setAnnees] = useState(20);
  const taux = 0.07;

  const capital = montant * 12 * annees;
  const compose = Array.from({ length: annees * 12 }).reduce(v => (v + montant) * (1 + taux / 12), 0);
  const simple  = capital + capital * taux / 2; // approximation intérêts simples

  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--line-1)',
      borderRadius: 'var(--r-lg)', padding: 20, margin: '20px 0',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 16 }}>
        Simulateur interactif
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
            Versement mensuel
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range" min="50" max="1000" step="50"
              value={montant} onChange={e => setMontant(+e.target.value)}
              className="range" style={{ flex: 1 }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
              {montant} €
            </span>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
            Durée
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range" min="5" max="40" step="5"
              value={annees} onChange={e => setAnnees(+e.target.value)}
              className="range" style={{ flex: 1 }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, minWidth: 60, textAlign: 'right' }}>
              {annees} ans
            </span>
          </div>
        </div>
      </div>
      <BarChart
        max={Math.ceil(compose / 1000) * 1000}
        data={[
          { label: 'Versé', valeur: Math.round(capital), color: 'var(--fg-3)' },
          { label: 'Livret A', valeur: Math.round(capital * (1 + 0.015 * annees / 2)), color: 'var(--info)' },
          { label: 'Composés', valeur: Math.round(compose), color: 'var(--accent)' },
        ]}
      />
      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 8 }}>
        Hypothèse : 7 %/an (moyenne historique MSCI World). Ce n'est pas une garantie.
      </div>
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────

const SECTIONS = [
  { id: 'inflation',  num: '01', titre: "Mon argent au fond du tiroir perd de la valeur" },
  { id: 'compound',   num: '02', titre: "Les intérêts composés : la 8e merveille du monde" },
  { id: 'etf',        num: '03', titre: "ETF : posséder 1 500 entreprises pour 200 €" },
  { id: 'dca',        num: '04', titre: "DCA : la méthode qui bat les experts" },
  { id: 'frais',      num: '05', titre: "Les frais : l'ennemi invisible de votre rendement" },
  { id: 'pea',        num: '06', titre: "PEA : économiser 13 % d'impôts sur vos gains" },
  { id: 'demarrer',   num: '07', titre: "Par où commencer concrètement ?" },
  { id: 'glossaire',  num: 'G',  titre: "Glossaire" },
];

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState('inflation');

  function scrollTo(id) {
    setActiveSection(id);
    document.getElementById('guide-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-title">Guide de l'investisseur</h1>
          <p className="page-sub">Les questions que tout le monde se pose, avec des réponses honnêtes et des chiffres réels.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 40, alignItems: 'start' }}>

        {/* ── TOC sticky ── */}
        <div style={{ position: 'sticky', top: 0, paddingTop: 4 }}>
          {SECTIONS.map(s => (
            <div
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10,
                padding: '9px 12px', cursor: 'pointer', borderRadius: 'var(--r-md)',
                background: activeSection === s.id ? 'var(--bg-2)' : 'transparent',
                borderLeft: `2px solid ${activeSection === s.id ? 'var(--accent)' : 'transparent'}`,
                marginBottom: 2,
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)',
                paddingTop: 2,
              }}>{s.num}</span>
              <span style={{
                fontSize: 12.5, color: activeSection === s.id ? 'var(--fg-0)' : 'var(--fg-2)',
                lineHeight: 1.4,
              }}>{s.titre}</span>
            </div>
          ))}
        </div>

        {/* ── Contenu ── */}
        <div style={{ maxWidth: 680, paddingBottom: 160 }}>

          {/* 01 · Inflation */}
          <section id="guide-inflation" style={{ marginBottom: 64, scrollMarginTop: 20 }}>
            <Q>Pourquoi est-ce que je perds de l'argent sans rien faire ?</Q>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 16px', letterSpacing: '-0.015em' }}>
              Mon argent au fond du tiroir perd de la valeur
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              L'inflation, c'est la hausse des prix avec le temps. Quand l'inflation est à 3 % par an,
              100 € aujourd'hui n'achèteront que l'équivalent de 97 € l'an prochain.
              Votre argent fond silencieusement, même à l'abri sur un compte courant.
            </p>

            <Callout type="danger" label="Exemple concret">
              Vous laissez 10 000 € sur votre compte courant pendant 10 ans.
              Avec 3 % d'inflation annuelle, votre pouvoir d'achat réel est tombé à <strong>7 441 €</strong>.
              Vous n'avez touché à rien. Vous avez quand même perdu 2 559 €.
            </Callout>

            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7 }}>
              Le Livret A rapporte aujourd'hui 1,5 % par an. Si l'inflation est à 2,5 %,
              vous perdez quand même 1 % de pouvoir d'achat chaque année, juste moins vite.
              Pour vraiment préserver et faire fructifier votre argent, il faut viser un rendement
              supérieur à l'inflation sur le long terme.
            </p>

            <Callout type="info" label="À retenir">
              Ne rien faire avec son argent, c'est déjà prendre une décision : celle de s'appauvrir
              lentement. Investir, c'est refuser cette option par défaut.
            </Callout>
          </section>

          {/* 02 · Intérêts composés */}
          <section id="guide-compound" style={{ marginBottom: 64, scrollMarginTop: 20 }}>
            <Q>C'est quoi les intérêts composés ?</Q>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 16px', letterSpacing: '-0.015em' }}>
              Les intérêts composés : la 8e merveille du monde
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              Avec les intérêts simples, vos gains restent fixes chaque année.
              Avec les intérêts composés, vos gains génèrent eux-mêmes des gains.
              C'est une boule de neige : plus elle roule, plus elle grossit vite.
            </p>

            <Comparaison
              gauche={{ label: 'Intérêts simples · 7 %/an', valeur: '24 000 €', sub: 'gain sur 10 000 € · 20 ans', color: 'var(--info)' }}
              droite={{ label: 'Intérêts composés · 7 %/an', valeur: '38 697 €', sub: 'gain sur 10 000 € · 20 ans', color: 'var(--accent)' }}
            />

            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              Même capital de départ, même taux, même durée. La différence vient uniquement
              de la capitalisation. Et cette différence s'amplifie avec le temps.
            </p>

            <Callout type="success" label="La leçon la plus importante">
              <strong>Le temps est votre meilleur allié.</strong> Commencer avec 100 €/mois à 25 ans
              produit plus qu'investir 300 €/mois à 45 ans pendant la même durée totale.
              Chaque année perdue ne se rattrape pas.
            </Callout>

            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              Simulez votre situation :
            </p>
            <SimulateurCompound />
          </section>

          {/* 03 · ETF */}
          <section id="guide-etf" style={{ marginBottom: 64, scrollMarginTop: 20 }}>
            <Q>Comment investir sans choisir des actions ?</Q>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 16px', letterSpacing: '-0.015em' }}>
              ETF : posséder 1 500 entreprises pour 200 €
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              Un ETF (Exchange-Traded Fund) est un panier d'actions que vous achetez en une transaction.
              Au lieu de décider si vous achetez Apple ou Microsoft, Total ou LVMH,
              vous achetez un ETF qui contient déjà toutes ces entreprises proportionnellement à leur taille.
            </p>

            <Callout type="info" label="Exemple : CW8 · Amundi MSCI World">
              Avec 200 €, vous devenez propriétaire d'une fraction des 1 500 plus grandes entreprises mondiales.
              Apple, Microsoft, Amazon, Nestlé, Toyota, Samsung : toutes dans un seul achat.
              Si Apple monte mais Toyota baisse, votre ETF suit la moyenne. Vous n'avez pas besoin
              d'avoir raison sur chaque entreprise.
            </Callout>

            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              C'est la différence entre parier sur un cheval et acheter la totalité des hippodromes du monde.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '20px 0' }}>
              {[
                { titre: 'Diversification', texte: 'Des centaines d\'entreprises. Si l\'une fait faillite, ça représente 0,01 % de votre portefeuille.' },
                { titre: 'Frais faibles', texte: 'Un ETF coûte 0,07 % à 0,40 %/an. Un gérant actif coûte 10 à 20 fois plus.' },
                { titre: 'Simplicité', texte: 'Un achat par mois. Pas d\'analyse, pas de veille, pas de décisions complexes.' },
                { titre: 'Liquidité', texte: 'Vous pouvez vendre en quelques secondes, à tout moment en journée de trading.' },
              ].map(item => (
                <div key={item.titre} style={{
                  padding: 14, background: 'var(--bg-1)',
                  border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--fg-0)', marginBottom: 6, fontSize: 13 }}>{item.titre}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.55 }}>{item.texte}</div>
                </div>
              ))}
            </div>

            <Callout type="warn" label="Idée reçue à démolir">
              <strong>"Il faut être riche pour investir en bourse."</strong> Faux. Vous pouvez acheter une fraction
              d'ETF pour quelques euros avec certains courtiers. Et le DCA mensuel (section suivante)
              est précisément conçu pour les gens qui investissent de petites sommes régulièrement.
            </Callout>
          </section>

          {/* 04 · DCA */}
          <section id="guide-dca" style={{ marginBottom: 64, scrollMarginTop: 20 }}>
            <Q>Quel est le bon moment pour investir ?</Q>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 16px', letterSpacing: '-0.015em' }}>
              DCA : la méthode qui bat les experts
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              Le DCA (Dollar-Cost Averaging, ou investissement programmé) consiste à investir
              un montant fixe chaque mois, peu importe ce que fait le marché.
              C'est l'opposé du market timing, qui consiste à essayer de deviner le bon moment.
            </p>

            <Callout type="danger" label="Le problème du timing">
              Une étude Schwab sur 20 ans a montré que la différence entre investir
              au parfait moment chaque année et investir le 1er du mois quoi qu'il arrive
              est de... <strong>moins de 1 % de rendement annuel</strong>. Et trouver le parfait moment
              est impossible de façon consistante. Les experts se trompent en permanence.
            </Callout>

            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              Le DCA a un autre avantage : quand les marchés baissent, vous achetez plus de parts
              pour le même prix. Quand ils montent, vous achetez moins mais vos parts existantes
              valent plus. Automatiquement, sans décision à prendre.
            </p>

            <Comparaison
              gauche={{ label: 'Investissement unique · jan 2020', valeur: '-33 %', sub: 'en mars 2020 (Covid)', color: 'var(--neg)' }}
              droite={{ label: 'DCA mensuel · 2020', valeur: '+18 %', sub: 'sur la même année', color: 'var(--pos)' }}
            />

            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7 }}>
              Celui qui a tout misé en janvier 2020 a vécu le crash du Covid à -33 % en pleine face.
              Celui qui a investi chaque mois a profité de la baisse pour acheter moins cher,
              et finit l'année en positif. Le DCA ne protège pas des pertes sur le long terme,
              mais il lisse les chocs.
            </p>

            <Callout type="success" label="La règle simple">
              Choisissez une somme que vous pouvez investir chaque mois sans vous en préoccuper.
              100 €, 200 €, 50 €. L'important c'est la régularité, pas le montant.
              Puis oubliez-la pendant 10 ans.
            </Callout>
          </section>

          {/* 05 · Frais */}
          <section id="guide-frais" style={{ marginBottom: 64, scrollMarginTop: 20 }}>
            <Q>Est-ce que 0,20 % de frais, ça change vraiment quelque chose ?</Q>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 16px', letterSpacing: '-0.015em' }}>
              Les frais : l'ennemi invisible de votre rendement
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              0,20 % par an, ça semble négligeable. Sur 30 ans avec l'effet de capitalisation,
              ça ne l'est pas du tout. La différence entre un ETF à 0,20 % et un fonds géré à 1,5 %
              est l'une des décisions financières les plus importantes de votre vie.
            </p>

            <Callout type="danger" label="Sur 30 ans · 200 €/mois · 7 % brut">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>ETF · TER 0,20 %</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pos)', fontFamily: 'var(--font-mono)' }}>228 000 €</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>Fonds géré · TER 1,5 %</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--neg)', fontFamily: 'var(--font-mono)' }}>174 000 €</div>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--fg-1)' }}>
                <strong>54 000 € de différence</strong>, uniquement à cause des frais. Vous avez versé exactement
                la même somme. Le marché a fait exactement la même performance. Les frais ont mangé le reste.
              </div>
            </Callout>

            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              Ce phénomène s'appelle la <strong>composante négative des frais</strong> : les frais se composent
              exactement comme vos gains, mais dans le sens inverse. Chaque euro payé en frais
              n'est plus là pour générer des intérêts sur les 29 années suivantes.
            </p>

            <div style={{ margin: '20px 0' }}>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginBottom: 12, letterSpacing: '0.06em' }}>
                TER TYPIQUES PAR TYPE DE PRODUIT
              </div>
              <BarChart
                max={2.5}
                unit="%/an"
                data={[
                  { label: 'ETF best', valeur: 0.07, color: 'var(--pos)' },
                  { label: 'ETF moyen', valeur: 0.25, color: 'var(--accent)' },
                  { label: 'Assurance-vie', valeur: 1.2, color: 'var(--warn)' },
                  { label: 'Fonds actif', valeur: 2.0, color: 'var(--neg)' },
                ]}
              />
            </div>

            <Callout type="info" label="Règle pratique">
              Pour un ETF monde (MSCI World), visez un TER en dessous de 0,40 %.
              Les meilleurs sont autour de 0,07 % à 0,20 %. Au-dessus de 0,50 %, cherchez une alternative.
            </Callout>
          </section>

          {/* 06 · PEA */}
          <section id="guide-pea" style={{ marginBottom: 64, scrollMarginTop: 20 }}>
            <Q>Comment payer moins d'impôts sur mes gains ?</Q>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 16px', letterSpacing: '-0.015em' }}>
              PEA : économiser 13 % d'impôts sur vos gains
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 16 }}>
              En France, les gains boursiers sont normalement taxés à <strong>30 %</strong> (flat tax) :
              17,2 % de prélèvements sociaux + 12,8 % d'impôt sur le revenu.
              Le PEA (Plan d'Épargne en Actions) supprime la partie impôt sur le revenu
              après 5 ans de détention. Il vous reste uniquement les 17,2 % de prélèvements sociaux.
            </p>

            <Comparaison
              gauche={{ label: 'Compte-titres ordinaire', valeur: '30 %', sub: 'sur vos gains', color: 'var(--neg)' }}
              droite={{ label: 'PEA (après 5 ans)', valeur: '17,2 %', sub: 'sur vos gains', color: 'var(--pos)' }}
            />

            <Callout type="success" label="Sur 100 000 € de gains">
              Compte-titres : vous payez <strong>30 000 €</strong> d'impôts.
              PEA : vous payez <strong>17 200 €</strong>. Soit <strong>12 800 € économisés</strong>,
              juste parce que vous avez mis votre argent au bon endroit.
            </Callout>

            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 12 }}>
              Quelques règles à connaître :
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 0 20px' }}>
              {[
                { ok: true,  texte: 'Plafond de versements : 150 000 € (vos gains peuvent dépasser ce plafond)' },
                { ok: true,  texte: 'Exonération d\'impôt sur le revenu après 5 ans de détention' },
                { ok: true,  texte: 'Vous pouvez avoir un PEA ET un compte-titres en parallèle' },
                { ok: false, texte: 'Seuls les ETF éligibles PEA peuvent y être logés (regardez le badge dans la liste)' },
                { ok: false, texte: 'Un retrait avant 5 ans clôture le plan (les retraits partiels après 5 ans sont libres)' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px', background: 'var(--bg-1)',
                  border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)',
                }}>
                  <span style={{ color: item.ok ? 'var(--pos)' : 'var(--warn)', flexShrink: 0, marginTop: 1 }}>
                    {item.ok ? '✓' : '!'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.5 }}>{item.texte}</span>
                </div>
              ))}
            </div>

            <Callout type="info" label="Conseil pratique">
              Ouvrez un PEA le plus tôt possible, même avec 100 €. Le compteur des 5 ans commence
              à la date d'ouverture, pas à la date de vos premiers versements. Chaque mois d'attente
              repousse votre exonération fiscale d'un mois.
            </Callout>
          </section>

          {/* 07 · Démarrer */}
          <section id="guide-demarrer" style={{ marginBottom: 64, scrollMarginTop: 20 }}>
            <Q>Par où je commence concrètement ?</Q>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 16px', letterSpacing: '-0.015em' }}>
              Par où commencer concrètement ?
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7, marginBottom: 20 }}>
              Voici les étapes dans l'ordre. Ne sautez pas d'étape, chacune prépare la suivante.
            </p>

            {[
              {
                num: '1',
                titre: 'Constituer votre matelas de sécurité',
                texte: 'Avant d\'investir quoi que ce soit : mettez 3 à 6 mois de dépenses sur un Livret A. C\'est votre assurance pour ne jamais être forcé de vendre vos ETF au mauvais moment.',
                tag: 'Non négociable',
                tagColor: 'var(--neg)',
              },
              {
                num: '2',
                titre: 'Ouvrir un PEA',
                texte: 'Contactez votre banque ou un courtier en ligne (Boursorama, Fortuneo, Trade Republic). Le PEA est l\'enveloppe fiscale optimale pour investir en ETF en France. Ouvrez-le même avec 100 € pour démarrer le compteur des 5 ans.',
                tag: 'Prioritaire',
                tagColor: 'var(--accent)',
              },
              {
                num: '3',
                titre: 'Choisir un ETF monde',
                texte: 'Un ETF qui suit l\'indice MSCI World (par exemple CW8 d\'Amundi, éligible PEA) convient à 90 % des investisseurs débutants. Il couvre les 1 500 plus grandes entreprises mondiales avec un TER d\'environ 0,38 %.',
                tag: 'Simple',
                tagColor: 'var(--pos)',
              },
              {
                num: '4',
                titre: 'Mettre en place un virement automatique',
                texte: 'Choisissez une somme mensuelle que vous n\'allez pas regretter. Configurez un virement automatique le jour de votre paie vers votre PEA. Puis oubliez. Ne regardez pas les cours tous les jours.',
                tag: 'Le plus important',
                tagColor: 'var(--accent)',
              },
              {
                num: '5',
                titre: 'Tenir sur la durée',
                texte: 'Il y aura des crises. Les marchés baisseront de 30, 40, 50 %. C\'est normal, ça s\'est passé plusieurs fois au XXe siècle et les marchés ont toujours récupéré. La plus grande erreur est de vendre pendant une crise.',
                tag: 'Discipline',
                tagColor: 'var(--info)',
              },
            ].map(step => (
              <div key={step.num} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr', gap: 16,
                marginBottom: 16,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--bg-2)', border: '1px solid var(--line-2)',
                  display: 'grid', placeItems: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
                  color: 'var(--fg-0)', flexShrink: 0,
                }}>{step.num}</div>
                <div style={{
                  padding: '14px 16px', background: 'var(--bg-1)',
                  border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-0)' }}>{step.titre}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9.5, padding: '2px 7px',
                      border: `1px solid ${step.tagColor}40`,
                      background: `${step.tagColor}15`,
                      color: step.tagColor, borderRadius: 3, letterSpacing: '0.06em',
                    }}>{step.tag}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--fg-1)', lineHeight: 1.6 }}>{step.texte}</p>
                </div>
              </div>
            ))}

            <Callout type="warn" label="Ce que ce guide ne vous dit pas">
              Votre situation personnelle (fiscalité, projets de vie, profil de risque) peut changer
              les priorités. Ce guide donne les grandes lignes valables pour la majorité des débutants.
              Pour une décision importante, consultez un conseiller financier indépendant.
            </Callout>
          </section>

          {/* Glossaire */}
          <section id="guide-glossaire" style={{ marginBottom: 64, scrollMarginTop: 20 }}>
            <Q>Les termes à connaître</Q>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 24px', letterSpacing: '-0.015em' }}>
              Glossaire
            </h2>
            {[
              { terme: 'ETF', def: 'Panier d\'actions coté en bourse. Permet de détenir des centaines d\'entreprises en un seul achat.' },
              { terme: 'MSCI World', def: 'Indice qui regroupe les 1 500 plus grandes entreprises des pays développés. La référence pour l\'investissement passif.' },
              { terme: 'TER', def: 'Total Expense Ratio. Le pourcentage que le fonds prélève chaque année pour couvrir ses frais de gestion. À minimiser.' },
              { terme: 'PEA', def: 'Plan d\'Épargne en Actions. Enveloppe fiscale française : pas d\'impôt sur le revenu sur les gains après 5 ans. Plafond 150 000 €.' },
              { terme: 'DCA', def: 'Dollar-Cost Averaging. Investir un montant fixe chaque mois, sans chercher le bon moment. Stratégie de référence pour les particuliers.' },
              { terme: 'CAGR', def: 'Compound Annual Growth Rate. Le taux de croissance annuel moyen. Permet de comparer des investissements sur des durées différentes.' },
              { terme: 'Flat tax', def: 'Prélèvement forfaitaire unique de 30 % sur les gains en capitaux. S\'applique hors PEA.' },
              { terme: 'Backtesting', def: 'Tester une stratégie d\'investissement sur des données passées. Utile pour comprendre, mais pas prédictif. Le passé ne garantit pas l\'avenir.' },
              { terme: 'Volatilité', def: 'Mesure de l\'amplitude des fluctuations d\'un actif. Une forte volatilité = des hauts et des bas importants. Normale sur le long terme.' },
              { terme: 'Indice', def: 'Panier représentatif d\'un marché. Le CAC 40 = 40 plus grandes entreprises françaises. Le S&P 500 = 500 plus grandes américaines.' },
            ].map(item => (
              <div key={item.terme} style={{
                display: 'grid', gridTemplateColumns: '100px 1fr', gap: 20,
                padding: '14px 0', borderBottom: '1px solid var(--line-1)',
                alignItems: 'baseline',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13,
                  color: 'var(--fg-0)', letterSpacing: '0.02em',
                }}>{item.terme}</span>
                <span style={{ fontSize: 13.5, color: 'var(--fg-1)', lineHeight: 1.6 }}>{item.def}</span>
              </div>
            ))}
          </section>

        </div>
      </div>
    </div>
  );
}
