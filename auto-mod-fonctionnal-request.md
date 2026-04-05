# Règles de modération

# Définition

## Mots

Signalement : concerne un seul message. Ce message est analysé avec son contexte. Le contexte doit obligatoirement être pris en compte afin de comprendre le message et d’évaluer si un warn suffit ou si une sanction effective est préférable.

Report : problème plus complexe qui ne se limite pas à un seul message.

Warn : sanction possible, la plus douce, pouvant avoir plusieurs degrés de gravité, faible, moyen ou élevé. Un warn est un sursis. Un rappel à l’ordre est un warn. En cas de récidive pour un problème similaire, l’infraction est requalifiée. Un warn a une durée de validité, actif ou inactif, définie dans les paramètres du serveur, non implémentée à ce jour. Pendant sa durée de validité, il est pris en compte lors des sanctions. On peut rattacher une sanction effective à un warn lorsque cela arrive. Dans ce cas, le warn n’est plus valide.

Sanction effective : toute sanction qui n’est pas un warn. Elle a également une durée de validité, actif ou inactif. Une sanction active n’est pas nécessairement encore en cours d’application. Il peut aussi s’agir d’une sanction passée qui continue d’influencer les jugements futurs. Une sanction révoquée est automatiquement inactive.

## Type de sanction possible

Le warn représente une sanction douce pouvant être utilisée lorsque le contexte montre qu’un rappel formel à l’ordre est suffisant. Le warn est à privilégier lorsqu’il paraît adapté.

L’exclusion, ou mute, est la sanction effective la plus granulaire et permet de sanctionner la majorité des comportements.

Le bannissement n’est jamais automatiquement initié par le bot. Il concerne les cas impardonnables ou les entorses continues au règlement. Le bot émet donc une exclusion de 7 jours en attendant une confirmation humaine de la sanction. Un bannissement est définitif, sauf annulation en cas d’erreur.

# Gravités par infraction

## Impardonnable

- Apologie génocidaire.  
- Apologie du terrorisme.  
- Récidive sur sanction grave active pour un comportement similaire.  
- Publication de contenu à caractère sexuel

## Grave

- Haine d’un groupe au premier degré (racisme, homophobie ).  
- Appel au meurtre ou son apologie.  
- Menace implicite crédible  
- Incitation au suicide.  
- Négationnisme.  
- Récidive sur sanction moyenne active pour un comportement similaire.  
- Divulgation d’information confidentielle d’une autre personne.  
- Tentative de contournement/corruption du système de modération.

## Moyen

- Dénigrement, violence verbale ou harcèlement ciblé sur une personne spécifique identifiée ou identifiable.  
- Recherche délibérée d’escalade.  
- Spam.  
- Récidive sur sanction faible active pour un comportement similaire.

## Faible

- Vocabulaire vulgaire et agressif répété.  
- Remarques sexuelles insistantes

# Exceptions

Les insultes ciblant une personne ne peuvent être reportées que par la personne concernée. En cas de doute, par exemple en cas d’utilisation de surnom ou de terminologie vague, l’utilisateur qui signale doit certifier être la personne ciblée. Sinon, la plainte n’a pas lieu.

L’humour noir n’est pas sanctionné.

Aucune action de modération ne sera engagée pour des propos tenus en dehors du serveur.

Les propos tenus dans des salons vocaux en l’absence de modérateur ne sont pas sanctionnés, sauf si un enregistrement audio est fourni dans le cadre d’un dossier.

Les contenus audio, vidéo ou image ne sont pas analysés par l’IA. L’utilisateur doit décrire leur contenu. Si cette description s’avère mensongère, la faute est requalifiée en grave.

Aucune sanction n’est prise pour des suspicions d’idéologie, comme le nazisme. Seuls les propos et comportements sont condamnables.

# Flux

## Évaluation d’une sanction

### Sanction de base

#### *Faible*

Elle va d’un warn faible à 5 minutes d’exclusion.

#### *Moyen*

Elle va d’un warn moyen à 15 minutes d’exclusion.

#### *Grave*

Elle va d’un warn élevé à 24 heures d’exclusion.

#### *Impardonnable*

7 jours d’exclusion en attendant une validation humaine pour le bannissement. Si la sanction est maintenue mais qu’il est choisi que ce ne soit pas un bannissement, elle est automatiquement reclassée en grave.

### Principe d’évaluation

Le contexte est obligatoirement pris en compte. Il permet de comprendre le message, d’évaluer le niveau de maîtrise du comportement et de déterminer si un warn est suffisant ou si une sanction effective est préférable. Le warn est à privilégier lorsqu’il est adapté à la situation.

### Multiplicateur

Chaque sanction part d’une durée de base définie ci-dessus.

Une peine peut avoir un multiplicateur total allant jusqu’à x7.

Les warns encore actifs ou les sanctions effectives encore actives ajoutent une majoration selon leur gravité :

- Faible : \+0,25.  
- Moyen : \+0,25.  
- Grave : \+0,5.

Le multiplicateur final est égal à 1 plus la somme des majorations applicables, sans pouvoir dépasser x7.

La durée finale est obtenue en appliquant ce multiplicateur à la durée de base.

La durée finale est arrondie à la minute supérieure.

Si le warn ou la sanction concerne une raison similaire, c’est-à-dire une récidive, alors l’infraction est requalifiée selon les règles de gravité prévues ci-dessus.

## Signalement

1. Le message est signalé par un utilisateur.  
2. L’IA récupère le contexte, 30 messages avant et après.  
3. Elle analyse le contenu et identifie le problème.  
   1. Le problème est une insulte ciblant une personne : L’IA identifie la personne concernée. Si elle n’y arrive pas, elle demande une certification à l’utilisateur. Si le signalement ne vient pas de la personne concernée, la plainte n’a pas lieu.  
   2. Le problème est clairement identifié et le doute est quasi nul, alors le flux continue.  
   3. Le problème n’est pas clairement identifié, alors le signalement devient un report et son flux s’applique.  
4. La sanction est évaluée.  
5. La sanction est émise et un message public est émis.  
6. La personne concernée reçoit un message privé avec la raison de la sanction lui proposant de déposer une réclamation en cliquant sur un bouton qui ouvre une fenêtre modale pour déposer la réclamation.  
7. Sans réclamation, le processus s’arrête ici. Sinon :  
   1. La réclamation est analysée par un modérateur humain depuis le dashboard où il retrouve la personne qui a signalé, un résumé du problème, le message concerné et un lien direct vers le message dans la page history.  
   2. Il peut alors révoquer la décision ou modifier la peine et doit ajouter un motif.  
   3. Il peut aussi sanctionner la réclamation s’il estime qu’elle est de mauvaise foi.  
   4. En cas de modification de la peine, la personne est notifiée.

## Report

2. L’utilisateur reporte un utilisateur.  
3. Un salon se crée.  
4. L’utilisateur prépare son dossier en indiquant tout ce qu’il a à dire.  
5. Il dépose le dossier.  
6. L’IA analyse le dossier et pose une série de questions complémentaires, si nécessaire.  
7. L’utilisateur dépose de nouveau.  
8. L’IA rédige un résumé du dossier selon la méthode QQOQCCP.  
9. L’utilisateur soit :  
   1. Confirme.  
   2. Indique si quelque chose est mal compris. Il écrit alors les réajustements. Dans ce cas, on revient à l’étape de résumé. C’est la dernière fois qu’il peut apporter des ajustements.  
2. La sanction est évaluée.  
3. La sanction est émise et un message public est émis.  
4. La personne concernée reçoit un message privé avec la raison de la sanction lui proposant de déposer une réclamation en cliquant sur un bouton qui ouvre une fenêtre modale pour déposer la réclamation.  
5. Sans réclamation, le processus s’arrête ici. Sinon :  
   1. La réclamation est analysée par un modérateur humain depuis le dashboard où il retrouve la personne qui a signalé, un résumé du problème, le message concerné et les éléments du dossier.  
   2. Il peut alors révoquer la décision ou modifier la peine et doit ajouter un motif.  
   3. Il peut aussi sanctionner la réclamation s’il estime qu’elle est de mauvaise foi.  
   4. En cas de modification de la peine, la personne est notifiée.

Utilise Langchain, Openrouter, duckduckgo et le modele sera minimax/minimax-m2.5:free et quand il y a plus minimax/minimax-m2.5
