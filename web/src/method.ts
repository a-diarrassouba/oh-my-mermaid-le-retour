import type { Grade, Level, Severity } from './api';
import type { Lang } from './i18n';

// "How is your security score computed?": the method behind the grade, at
// the reader's level, with its sources. The numbers repeat gradeAudit
// (src/lib/audit.ts) and the steps the prisme-security skill: change them
// together.

/** One text, or one per reader level (junior falls back to senior). */
export type L = string | { novice: string; junior?: string; senior: string };
export const pick = (text: L, level: Level): string =>
  typeof text === 'string' ? text : level === 'novice' ? text.novice : level === 'junior' ? text.junior ?? text.senior : text.senior;

export const PENALTY: Record<Severity, number> = { critical: 30, high: 15, medium: 6, low: 2 };
export const CAP: Partial<Record<Severity, number>> = { low: 10, medium: 30 };
export const THRESHOLDS = [['A', 90], ['B', 75], ['C', 60], ['D', 40], ['E', 0]] as const;

/** The steps of gradeAudit (src/lib/audit.ts) on this audit's counts. */
export function explainGrade(counts: Record<Severity, number>) {
  const rows = (['critical', 'high', 'medium', 'low'] as Severity[]).map(s => {
    const raw = counts[s] * PENALTY[s];
    return { sev: s, n: counts[s], raw, minus: CAP[s] !== undefined ? Math.min(raw, CAP[s]!) : raw };
  });
  const score = Math.max(0, 100 - rows.reduce((a, r) => a + r.minus, 0));
  const byScore = THRESHOLDS.find(([, min]) => score >= min)![0] as Grade;
  const cap: { sev: Severity; grade: Grade } | null = counts.critical ? { sev: 'critical', grade: 'D' } : counts.high ? { sev: 'high', grade: 'C' } : null;
  const grade = cap && byScore < cap.grade ? cap.grade : byScore;
  return { rows, score, byScore, cap: cap && byScore < cap.grade ? cap : null, grade };
}

export const STRIDE_LETTERS = ['S', 'T', 'R', 'I', 'D', 'E'] as const;
export const OWASP_CODES = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10'] as const;

export interface MethodText {
  title: string; lead: L;
  flowTitle: string; flowScore: string; flowBeside: string; flow: { name: string; note: string }[]; flowSide: { name: string; note: string }[]; flowText: L;
  stepsTitle: string; steps: { name: string; text: L }[];
  formulaTitle: string; formulaIntro: L; perFlaw: string; capped: string; thresholdsTitle: string; capsText: L;
  exampleTitle: string; exampleNone: string; exampleStart: string; exampleScore: string; exampleCap: string; exampleGrade: string;
  severityTitle: string; severityIntro: L; severities: Record<Severity, L>;
  areasTitle: string; areasIntro: L; areas: Record<string, L>;
  owaspTitle: string; owaspIntro: L; owasp: Record<(typeof OWASP_CODES)[number], string>; owaspNote: string;
  strideTitle: string; strideIntro: L; stride: Record<(typeof STRIDE_LETTERS)[number], { property: string; text: L }>;
  originsTitle: string; origins: { name: string; text: L }[];
  limitsTitle: string; limits: string[];
  sourcesTitle: string; sources: { label: string; url: string; what: string }[];
  back: string;
}

const SOURCE_URLS = {
  stride: 'https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats',
  strideWiki: 'https://en.wikipedia.org/wiki/STRIDE_model',
  owaspThreat: 'https://owasp.org/www-community/Threat_Modeling',
  owasp2021: 'https://owasp.org/Top10/2021/',
  owasp2025: 'https://owasp.org/Top10/2025/',
  owaspAbout: 'https://owasp.org/about/',
  ultrareview: 'https://code.claude.com/docs/en/ultrareview',
  cisa: 'https://www.cisa.gov/securebydesign',
  scorecard: 'https://scorecard.dev/',
  cvss: 'https://www.first.org/cvss/',
  cwe: 'https://cwe.mitre.org/',
  nutri: 'https://www.santepubliquefrance.fr/en/nutri-score',
};

const fr: MethodText = {
  title: 'Comment est calculé votre score de sécurité',
  lead: {
    novice: "Imaginez le contrôle technique d'une voiture, mais pour un logiciel. Plusieurs contrôleurs lisent le code, un autre vérifie qu'ils ne se sont pas trompés, et la note de A à E se calcule ensuite toujours de la même façon, comme un barème. Voici chaque étape, les méthodes reconnues sur lesquelles elle s'appuie, et leurs sources.",
    junior: "La note vient d'un audit fait par Claude qui lit le code : deux auditeurs en parallèle, un vérificateur qui essaie de les contredire, puis un juge. Seules les failles confirmées comptent, et prisme calcule la note avec une formule fixe, sans IA. Les domaines vérifiés, l'OWASP Top 10 et STRIDE servent à ne rien oublier et à classer ce qui est trouvé.",
    senior: "Audit par lecture du code (2 auditeurs parallèles sur 13 domaines, vérification contradictoire à l'aveugle, arbitrage), puis note déterministe calculée par prisme à partir des seules sévérités confirmées. OWASP Top 10 (2021) sert d'étiquette de classement, STRIDE par élément alimente le modèle de menaces ; ni l'un ni l'autre n'entre dans la formule.",
  },
  flowTitle: 'Comment tout cela s’articule',
  flowScore: 'Ce qui fait la note', flowBeside: 'À côté de la note (ne la change pas)',
  flow: [
    { name: 'Pistes automatiques', note: 'prisme security, sans IA' },
    { name: '2 auditeurs', note: '13 domaines · étiquette OWASP' },
    { name: 'Vérificateur', note: 'essaie de les contredire' },
    { name: 'Juge', note: 'garde, écarte, note la gravité' },
    { name: 'Note A à E', note: 'formule fixe' },
  ],
  flowSide: [
    { name: 'Carte du projet', note: 'les blocs et leurs liens' },
    { name: 'STRIDE par bloc', note: 'menaces réalistes' },
    { name: 'Questions de conception', note: 'secure by design' },
  ],
  flowText: {
    novice: "En haut, le chemin qui mène à la note. En bas, ce qui aide à réfléchir à la sécurité du projet sans changer la note : la liste des menaces possibles pour chaque partie, et les questions à se poser.",
    senior: "Seules les failles confirmées par le juge entrent dans la formule. Le modèle STRIDE et les questions sont écrits à partir de la carte et des constats de l'audit ; une menace « ouverte » qui est une faille doit correspondre à un constat.",
  },
  stepsTitle: "Les étapes de l'audit",
  steps: [
    { name: '1. Les pistes automatiques', text: {
      novice: "Comme le portique de l'aéroport : il sonne souvent, même pour une ceinture. prisme cherche sans IA des motifs connus (un mot de passe écrit dans le code, une fonction dangereuse, une bibliothèque connue pour avoir une faille). Ces alertes ne comptent pas dans la note : ce sont seulement des endroits à regarder.",
      junior: "`prisme security` cherche des motifs connus sans IA : secrets dans les fichiers suivis par git, appels risqués (eval, exec, SQL construit à la main…), avis de sécurité des dépendances (npm audit), bonnes pratiques de dépôt dans l'esprit d'OpenSSF Scorecard. Ce sont des pistes : elles ne comptent pas tant que personne n'a lu le code.",
      senior: "Recherches par motifs (secrets, sinks dangereux), avis de dépendances (npm audit, OSV si installé), contrôles de pratiques façon OpenSSF Scorecard. Taux de faux positifs élevé assumé : sortie non notée, utilisée comme pistes par les auditeurs.",
    } },
    { name: '2. Deux auditeurs en parallèle', text: {
      novice: "Deux inspecteurs se partagent la maison : l'un regarde les portes, les clés et qui a le droit d'entrer ; l'autre l'électricité, la plomberie et l'entretien. Chacun lit vraiment le code et ne garde un problème que s'il peut expliquer comment quelqu'un s'en servirait.",
      junior: "Auditeur 1 : secrets, connexion, droits d'accès, injection, XSS, fichiers, SSRF. Auditeur 2 : chiffrement, dépendances, configuration, CI, exposition des données, surcharge. Chacun part des points d'entrée, suit la donnée (source → contrôles → endroit sensible), vérifie que le code tourne en production, puis confirme ou écarte avec la raison.",
      senior: "Deux agents en lecture seule, domaines disjoints, même brief projet et même grille de sévérité. Chaque candidat est tracé de la source au sink ; code de test, scripts ponctuels et exemples exclus ; doublons regroupés (`also`).",
    } },
    { name: '3. Le vérificateur contradictoire', text: {
      novice: "Un troisième inspecteur arrive sans avoir entendu les deux premiers. Son travail : prouver qu'ils se trompent. Il revérifie chaque problème, chaque fausse alerte écartée, et cherche ce qu'ils auraient oublié.",
      junior: "Il ne reçoit que les conclusions, pas le raisonnement (et pas les preuves), pour ne pas être influencé. Pour chaque faille, il cherche un contrôle oublié (middleware, protection du framework, validation ailleurs) ; il revérifie les pistes écartées et lit les endroits risqués des domaines marqués « rien trouvé ».",
      senior: "Verdict par constat : confirmé, réfuté (avec preuve dans le code) ou incertain ; réouverture possible des pistes écartées ; liste des failles manquées. Aveugle sur l'argumentaire des auditeurs pour limiter le biais de confirmation.",
    } },
    { name: '4. Le juge', text: {
      novice: "Claude tranche, problème par problème, en relisant le code quand les inspecteurs ne sont pas d'accord. Dans le doute, le problème n'est pas gardé : il est signalé comme un point à vérifier.",
      junior: "Confirmé → gardé. Réfuté avec une preuve qui tient → écarté avec la raison. Réfuté sans preuve solide → gardé comme « contesté », avec la raison. Incertain → relu ; non confirmé, il n'est pas gardé. Chaque faille gardée reçoit sa gravité selon la grille.",
      senior: "Arbitrage par relecture du code cité. `verification`: confirmed | contested | added, avec `verificationNote` obligatoire pour contested/added. Les compteurs `refuted` et `added` sont publiés dans le rapport.",
    } },
    { name: '5. Le calcul de la note', text: {
      novice: "La note n'est pas donnée par l'IA : prisme la calcule avec un barème fixe à partir du nombre de problèmes et de leur gravité. Deux audits qui trouvent la même chose ont donc toujours la même note.",
      junior: "`prisme security audit write` vérifie le brouillon (fichiers suivis par git, lignes existantes, chaque domaine couvert, aucun domaine « rien trouvé » avec une faille) puis calcule la note avec la formule ci-dessous.",
      senior: "Validation stricte du YAML (portée = `git ls-files` hors `.claude/`), puis `gradeAudit` : pénalités par sévérité, plafonds sur moyenne et faible, seuils, plafond de note par sévérité maximale. Aucune pondération par l'IA.",
    } },
  ],
  formulaTitle: 'La formule',
  formulaIntro: {
    novice: "On part de 100 points. Chaque problème retire des points selon sa gravité. Les petits points d'amélioration ont une limite, pour qu'une longue liste de détails ne cache pas l'essentiel.",
    senior: "score = max(0, 100 − 30·critique − 15·élevée − min(30, 6·moyenne) − min(10, 2·faible)).",
  },
  perFlaw: '{n} points par faille', capped: '{max} au plus',
  thresholdsTitle: 'De points à lettre',
  capsText: {
    novice: "Et une règle de bon sens : il suffit d'une seule porte grande ouverte pour entrer. Avec un problème critique, la note est au mieux D ; avec un problème élevé, au mieux C, quel que soit le nombre de points.",
    senior: "Plafonds de note : ≥ 1 critique → D au mieux ; sinon ≥ 1 élevée → C au mieux. Un attaquant n'a besoin que d'une faille exploitable : le score seul la diluerait.",
  },
  exampleTitle: 'Votre note, pas à pas', exampleNone: "Aucun audit pour l'instant : l'exemple apparaîtra après le premier.",
  exampleStart: 'Départ', exampleScore: 'Score', exampleCap: 'Plafond : au moins une faille de gravité « {sev} »', exampleGrade: 'Note',
  severityTitle: 'La gravité de chaque faille',
  severityIntro: {
    novice: "La gravité dépend de ce qui pourrait vraiment arriver dans ce projet, pas d'une étiquette générale.",
    senior: "Grille contextuelle, inspirée des niveaux qualitatifs de CVSS (critique, élevée, moyenne, faible) : le contexte du projet prime sur la sévérité publiée d'un outil ou d'un avis.",
  },
  severities: {
    critical: { novice: "N'importe qui sur internet peut s'en servir tout de suite, sans compte, et le dégât est grave (un mot de passe de production dans le code, prendre le contrôle du serveur).", senior: "Exploitable maintenant, depuis l'extérieur, sans accès particulier, impact sévère : secret de production dans le dépôt, RCE non authentifiée, injection SQL sur une route publique, contournement d'authentification." },
    high: { novice: "Facile à utiliser avec un compte ordinaire, avec un vrai dégât (voir les données des autres clients).", senior: "Exploitable avec peu d'effort ou une condition courante, impact significatif : IDOR, XSS stockée, secret hors production avec un vrai accès, dépendance vulnérable atteignable avec exploit connu." },
    medium: { novice: "Une vraie faiblesse, mais difficile à utiliser ou aux conséquences limitées.", senior: "Faiblesse réelle à impact limité ou difficile à exploiter : pas de limitation des tentatives de connexion, en-têtes de sécurité utiles manquants, erreurs trop bavardes." },
    low: { novice: "Une bonne habitude à prendre pour renforcer le projet.", senior: "Durcissement et bonnes pratiques : pas de SECURITY.md, actions CI non épinglées, conteneur en root, pas de mise à jour automatique des dépendances." },
  },
  areasTitle: 'Les 13 domaines vérifiés',
  areasIntro: {
    novice: "La liste de contrôle des inspecteurs. Elle garantit qu'on n'oublie rien : chaque domaine finit avec « rien trouvé », « problèmes trouvés », « vu rapidement » ou « ne s'applique pas ».",
    senior: "Checklist obligatoire : chaque domaine doit figurer dans `checked` avec un statut ; un domaine « ok » qui porte une faille est refusé. Les domaines recoupent l'OWASP Top 10 et l'ASVS sans s'y limiter (CI/CD, dépendances).",
  },
  areas: {
    secrets: { novice: "Des clés ou mots de passe laissés dans le code, comme une clé sous le paillasson.", senior: 'Clés, jetons, mots de passe dans les fichiers suivis ; `.env` commité. Les fichiers d’exemple ne comptent pas.' },
    auth: { novice: 'Comment on se connecte, et comment les mots de passe sont gardés.', senior: 'Connexion, hachage des mots de passe, sessions et jetons (signature, expiration), réinitialisation, MFA, force brute.' },
    'access-control': { novice: 'Chacun ne voit que ce qui est à lui.', senior: 'Chaque route qui lit ou modifie : utilisateur vérifié et objet à lui (IDOR), routes admin, rôles, isolation multi-clients.' },
    injection: { novice: "Empêcher qu'un texte tapé par quelqu'un soit pris pour un ordre.", senior: 'SQL construit depuis l’entrée, commandes shell, templates, NoSQL, LDAP, eval.' },
    xss: { novice: "Empêcher qu'un message piégé fasse agir la page à la place de l'utilisateur.", senior: 'HTML construit depuis du contenu utilisateur, innerHTML, dangerouslySetInnerHTML, Markdown non nettoyé, CSP.' },
    files: { novice: "Les fichiers qu'on envoie ou qu'on lit : pas question d'aller fouiller ailleurs.", senior: 'Chemins depuis l’entrée (traversée), envois (type, taille, stockage), extraction d’archives, permissions.' },
    ssrf: { novice: "Le serveur ne doit pas aller chercher n'importe quelle adresse qu'on lui donne.", senior: 'Requêtes serveur vers des URL venant de l’entrée, webhooks, redirections ouvertes.' },
    crypto: { novice: 'Les cadenas utilisés pour protéger les données sont-ils solides ?', senior: 'Algorithmes faibles ou maison, aléa non cryptographique, TLS désactivé, clés dans le code.' },
    dependencies: { novice: 'Les briques prises ailleurs ont-elles des défauts connus ?', senior: 'Failles connues dans les dépendances de production réellement atteignables ; paquets abandonnés ou suspects.' },
    config: { novice: 'Les réglages : portes laissées ouvertes par défaut, messages qui en disent trop.', senior: 'CORS, cookies (Secure, HttpOnly, SameSite), en-têtes, modes debug, erreurs verbeuses, identifiants par défaut, Docker en root.' },
    'ci-cd': { novice: 'La chaîne qui construit et met en ligne le projet.', senior: 'Droits des workflows, secrets en CI, entrée non fiable dans les scripts, actions non épinglées, pull_request_target.' },
    'data-exposure': { novice: 'Des données personnelles qui se retrouvent là où il ne faut pas.', senior: 'Données sensibles dans les journaux, réponses d’API trop riches, sauvegardes, analytics.' },
    dos: { novice: "Empêcher qu'on bloque le service en le noyant de demandes.", senior: 'Limites de taille, limitation de débit sur la connexion et les routes coûteuses, boucles non bornées.' },
  },
  owaspTitle: "L'OWASP Top 10",
  owaspIntro: {
    novice: "L'OWASP est une fondation à but non lucratif où des milliers de spécialistes partagent leurs connaissances. Son « Top 10 » est la liste des 10 familles de problèmes de sécurité les plus courantes dans les applications web. Chaque faille de l'audit porte le numéro de sa famille, pour que vous puissiez en lire plus.",
    junior: "L'OWASP Top 10 est la référence la plus connue des risques des applications web, établie par la fondation OWASP à partir des données de nombreuses organisations. Chaque faille porte un code (A01 à A10) : il sert à la classer et à trouver de la documentation, pas à calculer la note.",
    senior: "Étiquette de classement `owasp` sur chaque constat (édition 2021). Non utilisée dans le calcul. Pour une analyse plus fine, le CWE (MITRE) donne la faiblesse précise.",
  },
  owasp: {
    A01: "Contrôle d'accès défaillant", A02: 'Défaillances cryptographiques', A03: 'Injection', A04: 'Conception non sécurisée',
    A05: 'Mauvaise configuration de sécurité', A06: 'Composants vulnérables et obsolètes', A07: "Défaillances d'identification et d'authentification",
    A08: "Défaillances d'intégrité des logiciels et des données", A09: 'Défaillances de journalisation et de surveillance', A10: 'Falsification de requête côté serveur (SSRF)',
  },
  owaspNote: "prisme utilise les codes de l'édition 2021. Une édition 2025 existe, avec un autre ordre et deux nouvelles familles (chaîne d'approvisionnement logicielle, gestion des cas exceptionnels) : un même code n'y désigne pas toujours la même famille.",
  strideTitle: 'STRIDE, pour penser aux menaces',
  strideIntro: {
    novice: "STRIDE est une liste de six questions pour imaginer ce qu'un malveillant pourrait faire, inventée chez Microsoft en 1999. prisme la pose pour chaque bloc de la carte qui touche l'extérieur ou garde quelque chose de précieux. Elle ne change pas la note : elle aide l'équipe à voir ce que le code seul ne montre pas.",
    junior: "STRIDE (Loren Kohnfelder et Praerit Garg, Microsoft, 1999) classe les menaces en six familles, chacune étant l'atteinte à une propriété de sécurité. prisme l'applique « par élément » : pour chaque bloc de la carte sur une frontière de confiance ou qui détient un bien à protéger, il garde les menaces réalistes, leur probabilité, leur impact et ce qui protège aujourd'hui.",
    senior: "STRIDE-per-element sur la carte : actifs, frontières de confiance (rôles entry/external), menaces avec probabilité, impact et statut (open, mitigated, accepted) ; une menace ouverte qui est une faille doit correspondre à un constat de l'audit. Hors formule de note.",
  },
  stride: {
    S: { property: 'Authenticité', text: { novice: "Se faire passer pour quelqu'un d'autre.", senior: "Usurper l'identité d'un utilisateur, d'un service ou du serveur." } },
    T: { property: 'Intégrité', text: { novice: 'Modifier quelque chose en chemin.', senior: 'Altérer des données, du code ou une requête.' } },
    R: { property: 'Non-répudiation', text: { novice: "Faire quelque chose sans que rien ne prouve qui l'a fait.", senior: "Agir sans trace attribuable (journaux absents ou falsifiables)." } },
    I: { property: 'Confidentialité', text: { novice: "Des informations arrivent chez quelqu'un qui ne devrait pas les voir.", senior: "Divulgation de données ou de secrets à un acteur non autorisé." } },
    D: { property: 'Disponibilité', text: { novice: 'Rendre le service lent ou indisponible.', senior: 'Déni de service : épuisement de ressources, blocage.' } },
    E: { property: 'Autorisation', text: { novice: "Obtenir plus de droits qu'on ne devrait.", senior: 'Élévation de privilèges : obtenir des droits non accordés.' } },
  },
  originsTitle: "D'où vient la méthode",
  origins: [
    { name: 'Plusieurs agents, puis une vérification', text: {
      novice: "L'idée vient de la relecture de code « ultra » de Claude Code : plusieurs agents relisent le code en même temps, et chaque problème est vérifié séparément avant d'être signalé. Ça évite les fausses alertes. prisme fait la même chose en plus petit, sur votre ordinateur.",
      senior: "Inspiré de /code-review ultra (ultrareview) de Claude Code : une flotte d'agents relit en parallèle et chaque constat est reproduit et vérifié de façon indépendante avant d'être rapporté. prisme en reprend le principe à petite échelle et en local : 2 auditeurs, 1 vérificateur à l'aveugle, 1 juge.",
    } },
    { name: 'Une lettre de A à E', text: {
      novice: "Comme le Nutri-Score sur les paquets de céréales : une lettre et une couleur que tout le monde comprend d'un coup d'œil, et le détail juste en dessous.",
      senior: "Échelle A–E et code couleur repris du Nutri-Score (Santé publique France) : lisible par un non-spécialiste, le détail restant accessible.",
    } },
    { name: 'Les questions de conception', text: {
      novice: "Elles viennent de l'idée de « sécurité dès la conception » : penser à la sécurité en dessinant le projet, pas seulement après coup.",
      senior: "Démarche Secure by Design (CISA) : questions ciblées sur les éléments de la carte, répondues depuis le code quand c'est possible, sinon laissées à l'équipe.",
    } },
  ],
  limitsTitle: 'Ce que la note ne dit pas',
  limits: [
    "Une note A ne veut pas dire « impossible à pirater » : l'audit lit le code de ce dépôt, pas les serveurs, leur configuration en production, ni les personnes qui les utilisent.",
    "Une IA peut se tromper. La vérification contradictoire réduit les erreurs sans les supprimer : chaque faille montre sa preuve dans le code pour qu'un humain puisse la contrôler.",
    "Les domaines « vu rapidement » n'ont pas été lus en profondeur : le résumé dit ce qui reste à vérifier.",
    "La note est une photo : relancez l'audit après chaque changement important.",
  ],
  sourcesTitle: 'Sources',
  sources: [
    { label: 'Microsoft — Threat Modeling Tool threats (STRIDE)', url: SOURCE_URLS.stride, what: 'Les six familles STRIDE et la propriété que chacune menace.' },
    { label: 'Wikipédia — STRIDE model', url: SOURCE_URLS.strideWiki, what: "L'origine (Kohnfelder et Garg, Microsoft, 1999) et STRIDE par élément." },
    { label: 'OWASP — Threat Modeling', url: SOURCE_URLS.owaspThreat, what: 'La modélisation des menaces expliquée par la communauté OWASP.' },
    { label: 'OWASP Top 10:2021', url: SOURCE_URLS.owasp2021, what: "L'édition dont prisme utilise les codes A01 à A10." },
    { label: 'OWASP Top 10:2025', url: SOURCE_URLS.owasp2025, what: 'La nouvelle édition.' },
    { label: 'OWASP Foundation', url: SOURCE_URLS.owaspAbout, what: 'Qui est derrière l’OWASP.' },
    { label: 'Claude Code — ultrareview (/code-review ultra)', url: SOURCE_URLS.ultrareview, what: 'La revue à plusieurs agents avec vérification indépendante dont s’inspire l’audit.' },
    { label: 'CISA — Secure by Design', url: SOURCE_URLS.cisa, what: 'La sécurité pensée dès la conception.' },
    { label: 'OpenSSF Scorecard', url: SOURCE_URLS.scorecard, what: 'Les bonnes pratiques de dépôt dont s’inspirent certaines pistes automatiques.' },
    { label: 'FIRST — CVSS', url: SOURCE_URLS.cvss, what: 'Le système de score des vulnérabilités et ses niveaux critique, élevé, moyen, faible.' },
    { label: 'MITRE — CWE', url: SOURCE_URLS.cwe, what: 'Le catalogue des faiblesses logicielles.' },
    { label: 'Santé publique France — Nutri-Score', url: SOURCE_URLS.nutri, what: "L'échelle de A à E qui a inspiré la note." },
  ],
  back: 'Retour au score',
};

const en: MethodText = {
  title: 'How your security score is computed',
  lead: {
    novice: "Picture a car inspection, but for software. Several inspectors read the code, another one checks they did not get it wrong, and the A to E grade is then always computed the same way, like a marking scheme. Here is each step, the well-known methods it relies on, and their sources.",
    junior: "The grade comes from an audit by Claude reading the code: two auditors in parallel, a verifier who tries to prove them wrong, then a judge. Only confirmed flaws count, and prisme computes the grade with a fixed formula, without AI. The areas checked, the OWASP Top 10 and STRIDE make sure nothing is forgotten and classify what is found.",
    senior: "Code-reading audit (2 parallel auditors over 13 areas, blind contradictory verification, arbitration), then a deterministic grade computed by prisme from confirmed severities only. OWASP Top 10 (2021) is a classification label, STRIDE per element feeds the threat model; neither enters the formula.",
  },
  flowTitle: 'How it all fits together',
  flowScore: 'What makes the grade', flowBeside: 'Next to the grade (does not change it)',
  flow: [
    { name: 'Automatic leads', note: 'prisme security, no AI' },
    { name: '2 auditors', note: '13 areas · OWASP label' },
    { name: 'Verifier', note: 'tries to prove them wrong' },
    { name: 'Judge', note: 'keeps, dismisses, rates' },
    { name: 'Grade A to E', note: 'fixed formula' },
  ],
  flowSide: [
    { name: 'Project map', note: 'the blocks and their links' },
    { name: 'STRIDE per block', note: 'realistic threats' },
    { name: 'Design questions', note: 'secure by design' },
  ],
  flowText: {
    novice: "At the top, the path to the grade. At the bottom, what helps think about the project's security without changing the grade: the possible threats for each part, and the questions to ask.",
    senior: "Only flaws confirmed by the judge enter the formula. The STRIDE model and the questions are written from the map and the audit's findings; an open threat that is a flaw must match a finding.",
  },
  stepsTitle: 'The steps of the audit',
  steps: [
    { name: '1. Automatic leads', text: {
      novice: "Like the airport gate: it beeps often, even for a belt. prisme looks, without AI, for known patterns (a password written in the code, a dangerous function, a library with a known flaw). These alerts do not count in the grade: they are only places to look at.",
      junior: "`prisme security` looks for known patterns without AI: secrets in files git tracks, risky calls (eval, exec, hand-built SQL…), dependency advisories (npm audit), repository practices in the spirit of OpenSSF Scorecard. They are leads: they count for nothing until someone has read the code.",
      senior: "Pattern searches (secrets, dangerous sinks), dependency advisories (npm audit, OSV when installed), OpenSSF Scorecard-style practice checks. High false-positive rate accepted: ungraded output, used as leads by the auditors.",
    } },
    { name: '2. Two auditors in parallel', text: {
      novice: "Two inspectors share the house: one looks at the doors, the keys and who may come in; the other at the wiring, the plumbing and the upkeep. Each one really reads the code and keeps a problem only if they can explain how someone would use it.",
      junior: "Auditor 1: secrets, sign-in, access rights, injection, XSS, files, SSRF. Auditor 2: encryption, dependencies, configuration, CI, data exposure, overload. Each starts from the entry points, follows the data (source → checks → sensitive place), checks the code runs in production, then confirms or dismisses with the reason.",
      senior: "Two read-only agents, disjoint areas, same project brief and severity rubric. Each candidate is traced from source to sink; tests, one-off scripts and examples excluded; duplicates grouped (`also`).",
    } },
    { name: '3. The contradictory verifier', text: {
      novice: "A third inspector comes in without having heard the first two. Their job: prove them wrong. They check each problem again, each false alarm that was set aside, and look for what the others missed.",
      junior: "It gets only the conclusions, not the reasoning (nor the evidence), so it is not swayed. For each flaw it looks for a missed check (middleware, framework protection, validation elsewhere); it re-checks the dismissed leads and reads the risky places of the areas marked \"nothing found\".",
      senior: "Per-finding verdict: confirmed, refuted (with proof in the code) or uncertain; dismissed leads may be reopened; list of missed flaws. Blind to the auditors' reasoning to limit confirmation bias.",
    } },
    { name: '4. The judge', text: {
      novice: "Claude decides, problem by problem, reading the code again when the inspectors disagree. When in doubt, the problem is not kept: it is reported as a point to check.",
      junior: "Confirmed → kept. Refuted with a proof that holds → dismissed with the reason. Refuted without a solid proof → kept as \"contested\", with the reason. Uncertain → read again; if not confirmed, not kept. Each kept flaw gets its severity from the rubric.",
      senior: "Arbitration by re-reading the cited code. `verification`: confirmed | contested | added, with a required `verificationNote` for contested/added. The `refuted` and `added` counts are published in the report.",
    } },
    { name: '5. Computing the grade', text: {
      novice: "The grade is not given by the AI: prisme computes it with a fixed scheme from the number of problems and how serious they are. Two audits that find the same things always get the same grade.",
      junior: "`prisme security audit write` checks the draft (files git tracks, lines that exist, every area covered, no \"nothing found\" area with a flaw), then computes the grade with the formula below.",
      senior: "Strict YAML validation (scope = `git ls-files` minus `.claude/`), then `gradeAudit`: per-severity penalties, caps on medium and low, thresholds, grade cap by highest severity. No AI weighting.",
    } },
  ],
  formulaTitle: 'The formula',
  formulaIntro: {
    novice: "You start with 100 points. Each problem takes points away depending on how serious it is. Small improvement points have a limit, so that a long list of details does not hide what matters.",
    senior: "score = max(0, 100 − 30·critical − 15·high − min(30, 6·medium) − min(10, 2·low)).",
  },
  perFlaw: '{n} points per flaw', capped: '{max} at most',
  thresholdsTitle: 'From points to letter',
  capsText: {
    novice: "And one common-sense rule: a single wide-open door is enough to get in. With a critical problem, the grade is D at best; with a high one, C at best, whatever the points.",
    senior: "Grade caps: ≥ 1 critical → D at best; otherwise ≥ 1 high → C at best. An attacker needs only one exploitable flaw: the score alone would dilute it.",
  },
  exampleTitle: 'Your grade, step by step', exampleNone: 'No audit yet: the example will show after the first one.',
  exampleStart: 'Start', exampleScore: 'Score', exampleCap: 'Cap: at least one "{sev}" flaw', exampleGrade: 'Grade',
  severityTitle: 'How serious each flaw is',
  severityIntro: {
    novice: "How serious a flaw is depends on what could really happen in this project, not on a general label.",
    senior: "Contextual rubric, modelled on CVSS's qualitative levels (critical, high, medium, low): the project's context wins over the severity a tool or an advisory publishes.",
  },
  severities: {
    critical: { novice: "Anyone on the internet can use it right away, without an account, and the damage is serious (a production password in the code, taking over the server).", senior: 'Exploitable now, from the outside, without special access, severe impact: production secret in the repository, unauthenticated RCE, SQL injection on a public route, authentication bypass.' },
    high: { novice: 'Easy to use with an ordinary account, with real damage (seeing other customers\' data).', senior: 'Exploitable with little effort or a common condition, significant impact: IDOR, stored XSS, a non-production secret with real access, a reachable vulnerable dependency with a known exploit.' },
    medium: { novice: 'A real weakness, but hard to use or with limited consequences.', senior: 'Real weakness with limited impact or hard to exploit: no rate limit on sign-in, useful security headers missing, verbose errors.' },
    low: { novice: 'A good habit to make the project stronger.', senior: 'Hardening and good practice: no SECURITY.md, unpinned CI actions, container as root, no dependency update bot.' },
  },
  areasTitle: 'The 13 areas checked',
  areasIntro: {
    novice: "The inspectors' checklist. It makes sure nothing is forgotten: each area ends with \"nothing found\", \"problems found\", \"looked at quickly\" or \"not applicable\".",
    senior: 'Mandatory checklist: every area must be in `checked` with a status; an "ok" area holding a flaw is refused. The areas overlap the OWASP Top 10 and ASVS without being limited to them (CI/CD, dependencies).',
  },
  areas: {
    secrets: { novice: 'Keys or passwords left in the code, like a key under the doormat.', senior: 'Keys, tokens, passwords in tracked files; `.env` committed. Example files do not count.' },
    auth: { novice: 'How people sign in, and how passwords are kept.', senior: 'Sign-in, password hashing, sessions and tokens (signature, expiry), reset, MFA, brute force.' },
    'access-control': { novice: 'Everyone sees only what is theirs.', senior: 'Every route that reads or changes data: user checked and object theirs (IDOR), admin routes, roles, tenant isolation.' },
    injection: { novice: 'Making sure text someone types is never taken as an order.', senior: 'SQL built from input, shell commands, templates, NoSQL, LDAP, eval.' },
    xss: { novice: 'Making sure a trapped message cannot make the page act for the user.', senior: 'HTML built from user content, innerHTML, dangerouslySetInnerHTML, uncleaned Markdown, CSP.' },
    files: { novice: 'Files sent or read: no rummaging anywhere else.', senior: 'Paths from input (traversal), uploads (type, size, storage), archive extraction, permissions.' },
    ssrf: { novice: 'The server must not fetch any address it is given.', senior: 'Server-side requests to URLs from input, webhooks, open redirects.' },
    crypto: { novice: 'Are the padlocks protecting the data strong?', senior: 'Weak or homemade algorithms, non-cryptographic randomness, TLS turned off, keys in code.' },
    dependencies: { novice: 'Do the bricks taken from elsewhere have known defects?', senior: 'Known flaws in production dependencies actually reachable; abandoned or suspicious packages.' },
    config: { novice: 'Settings: doors left open by default, messages that say too much.', senior: 'CORS, cookies (Secure, HttpOnly, SameSite), headers, debug modes, verbose errors, default credentials, Docker as root.' },
    'ci-cd': { novice: 'The chain that builds the project and puts it online.', senior: 'Workflow rights, secrets in CI, untrusted input in scripts, unpinned actions, pull_request_target.' },
    'data-exposure': { novice: 'Personal data ending up where it should not.', senior: 'Sensitive data in logs, API responses returning too much, backups, analytics.' },
    dos: { novice: 'Making sure nobody can block the service by flooding it.', senior: 'Size limits, rate limiting on sign-in and costly routes, unbounded loops.' },
  },
  owaspTitle: 'The OWASP Top 10',
  owaspIntro: {
    novice: "OWASP is a non-profit foundation where thousands of specialists share what they know. Its \"Top 10\" is the list of the 10 most common families of security problems in web applications. Each flaw of the audit carries its family's number, so you can read more about it.",
    junior: "The OWASP Top 10 is the best-known reference of web application risks, built by the OWASP foundation from the data of many organizations. Each flaw carries a code (A01 to A10): it classifies the flaw and helps find documentation, it does not compute the grade.",
    senior: '`owasp` classification label on each finding (2021 edition). Not used in the computation. For finer analysis, CWE (MITRE) names the precise weakness.',
  },
  owasp: {
    A01: 'Broken Access Control', A02: 'Cryptographic Failures', A03: 'Injection', A04: 'Insecure Design',
    A05: 'Security Misconfiguration', A06: 'Vulnerable and Outdated Components', A07: 'Identification and Authentication Failures',
    A08: 'Software and Data Integrity Failures', A09: 'Security Logging and Monitoring Failures', A10: 'Server-Side Request Forgery (SSRF)',
  },
  owaspNote: 'prisme uses the codes of the 2021 edition. A 2025 edition exists, with another order and two new families (software supply chain, mishandling of exceptional conditions): the same code does not always name the same family there.',
  strideTitle: 'STRIDE, to think about threats',
  strideIntro: {
    novice: "STRIDE is a list of six questions to imagine what someone with bad intentions could do, invented at Microsoft in 1999. prisme asks them for each block of the map that touches the outside or keeps something valuable. It does not change the grade: it helps the team see what the code alone does not show.",
    junior: "STRIDE (Loren Kohnfelder and Praerit Garg, Microsoft, 1999) sorts threats into six families, each one an attack on a security property. prisme applies it \"per element\": for each block of the map on a trust boundary or holding an asset, it keeps the realistic threats, their likelihood, their impact and what protects today.",
    senior: 'STRIDE-per-element on the map: assets, trust boundaries (entry/external roles), threats with likelihood, impact and status (open, mitigated, accepted); an open threat that is a flaw must match an audit finding. Outside the grade formula.',
  },
  stride: {
    S: { property: 'Authenticity', text: { novice: 'Pretending to be someone else.', senior: 'Impersonating a user, a service or the server.' } },
    T: { property: 'Integrity', text: { novice: 'Changing something on the way.', senior: 'Altering data, code or a request.' } },
    R: { property: 'Non-repudiation', text: { novice: 'Doing something with nothing to prove who did it.', senior: 'Acting without an attributable trace (missing or forgeable logs).' } },
    I: { property: 'Confidentiality', text: { novice: 'Information reaching someone who should not see it.', senior: 'Disclosure of data or secrets to an unauthorized party.' } },
    D: { property: 'Availability', text: { novice: 'Making the service slow or unavailable.', senior: 'Denial of service: resource exhaustion, blocking.' } },
    E: { property: 'Authorization', text: { novice: 'Getting more rights than one should.', senior: 'Elevation of privilege: gaining rights not granted.' } },
  },
  originsTitle: 'Where the method comes from',
  origins: [
    { name: 'Several agents, then a verification', text: {
      novice: "The idea comes from Claude Code's \"ultra\" code review: several agents read the code at the same time, and each problem is checked separately before it is reported. That avoids false alarms. prisme does the same on a smaller scale, on your computer.",
      senior: "Modelled on Claude Code's /code-review ultra (ultrareview): a fleet of agents reviews in parallel and every finding is independently reproduced and verified before it is reported. prisme keeps the principle at a small scale and locally: 2 auditors, 1 blind verifier, 1 judge.",
    } },
    { name: 'A letter from A to E', text: {
      novice: 'Like the Nutri-Score on cereal boxes: a letter and a color everyone understands at a glance, and the details just below.',
      senior: 'A–E scale and colors taken from the Nutri-Score (Santé publique France): readable by a non-specialist, details still at hand.',
    } },
    { name: 'The design questions', text: {
      novice: 'They come from the idea of "secure by design": thinking about security while drawing the project, not only afterwards.',
      senior: 'Secure by Design approach (CISA): questions aimed at the map\'s elements, answered from the code when possible, otherwise left to the team.',
    } },
  ],
  limitsTitle: 'What the grade does not say',
  limits: [
    'A grade A does not mean "impossible to hack": the audit reads the code of this repository, not the servers, their production settings, nor the people who use them.',
    'An AI can be wrong. The contradictory verification reduces mistakes without removing them: each flaw shows its proof in the code so a person can check it.',
    'Areas "looked at quickly" were not read in depth: the summary says what remains to check.',
    'The grade is a snapshot: run the audit again after every significant change.',
  ],
  sourcesTitle: 'Sources',
  sources: [
    { label: 'Microsoft — Threat Modeling Tool threats (STRIDE)', url: SOURCE_URLS.stride, what: 'The six STRIDE families and the property each one threatens.' },
    { label: 'Wikipedia — STRIDE model', url: SOURCE_URLS.strideWiki, what: 'The origin (Kohnfelder and Garg, Microsoft, 1999) and STRIDE per element.' },
    { label: 'OWASP — Threat Modeling', url: SOURCE_URLS.owaspThreat, what: 'Threat modeling explained by the OWASP community.' },
    { label: 'OWASP Top 10:2021', url: SOURCE_URLS.owasp2021, what: 'The edition whose codes A01 to A10 prisme uses.' },
    { label: 'OWASP Top 10:2025', url: SOURCE_URLS.owasp2025, what: 'The new edition.' },
    { label: 'OWASP Foundation', url: SOURCE_URLS.owaspAbout, what: 'Who is behind OWASP.' },
    { label: 'Claude Code — ultrareview (/code-review ultra)', url: SOURCE_URLS.ultrareview, what: 'The multi-agent review with independent verification the audit is modelled on.' },
    { label: 'CISA — Secure by Design', url: SOURCE_URLS.cisa, what: 'Security thought of from the design.' },
    { label: 'OpenSSF Scorecard', url: SOURCE_URLS.scorecard, what: 'The repository practices some automatic leads are modelled on.' },
    { label: 'FIRST — CVSS', url: SOURCE_URLS.cvss, what: 'The vulnerability scoring system and its critical, high, medium, low levels.' },
    { label: 'MITRE — CWE', url: SOURCE_URLS.cwe, what: 'The catalog of software weaknesses.' },
    { label: 'Santé publique France — Nutri-Score', url: SOURCE_URLS.nutri, what: 'The A to E scale that inspired the grade.' },
  ],
  back: 'Back to the score',
};

export const METHOD: Record<Lang, MethodText> = { fr, en };
