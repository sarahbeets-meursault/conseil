# Statistiques newsletters Meursault Conseil

Tableau de bord des newsletters internes et externes du cabinet, dans la DA Meursault. Les chiffres viennent de Mailchimp et se mettent à jour automatiquement le 1er de chaque mois.

## Mise en route (à faire une seule fois)

1. **Créer une clé API Mailchimp** dans Mailchimp, menu du profil, puis Extras et Clés API, bouton « Créer une clé ». Elle ressemble à `xxxxxxxx-us16`.
2. **L'ajouter au dépôt GitHub** dans Settings, Secrets and variables, Actions, bouton « New repository secret », avec le nom `MAILCHIMP_API_KEY` et la clé en valeur.
3. **Activer le site** dans Settings, Pages, Source « Deploy from a branch », branche `main` et dossier `/ (root)`.
4. **Lancer une première mise à jour** dans l'onglet Actions, « Mise à jour des statistiques Mailchimp » puis « Run workflow ».

Ensuite tout est automatique le 1er de chaque mois vers 6h, et le bouton « Run workflow » permet de forcer une mise à jour à tout moment.

## Classer les campagnes en interne ou externe

Le fichier `config.json` décide du classement. Une campagne dont le titre contient « La Vie de Meursault » est rangée en interne, celles qui contiennent « Meursault Insights » en externe, et toutes les autres prennent le type par défaut (externe). On peut aussi ranger par audience Mailchimp ou forcer une campagne précise avec son identifiant dans `overrides`.

## Contenu

- `index.html`, `assets/` le site et ses graphiques
- `data/campaigns.json` les statistiques, réécrites automatiquement
- `scripts/fetch_mailchimp.py` le script qui interroge Mailchimp
- `.github/workflows/update-stats.yml` la tâche quotidienne
