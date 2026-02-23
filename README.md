# scheiss-aufn-billa - Die App
## Allgemein
Ein satirisches Open-Source-Kunstprojekt und zugleich ein minimalistischer Web-Counter.

Die Web-App zählt mit einem Augenzwinkern, wie oft man bewusst auf einen Einkauf bei gewissen Supermärkten verzichtet hat.
Kein Ernst, kein Wirtschaftskrieg sondern nur ein bissl Schmäh, Gamification und Selbstironie.

Die App bietet aktuell
- einen simplen Counter
- Achievements (Errungenschaften) fürs
  - durchhalten
  - weitermachen
  - rückfällig werden
- ein optionalas Lewakas Captcha
- eine Prise österreichischen Grant
- 100% Open Source

Das Projekt versteht sich als digitale Satire und künstlerischer Kommentar zum Konsumverhalten, Markenloyalität und unserem inneren „Heute geh i aber wirklich woanders einkaufen“-Vorsatz.

Es besteht keinerlei Verbindung zu jeglichen Supermärkten, Marken oder anderen Handelsunternehmen.
Alles ist mit Humor zu verstehen.

Verfügbar im Web unter: [Scheiss aufn BILLA](https://apfelbox1.github.io/scheiss-aufn-billa/)


## Interesse mitzumachen?

Du willst beitragen? Sehr gerne.

1. Repository auf GitHub forken oder auschecken  
2. Änderungen umsetzen  
3. Pull Request erstellen  

Beiträge aller Art sind willkommen – Code, Ideen, Achievements, UI-Verbesserungen oder satirischer Feinschliff.

### Wichtig: Urheberrecht beachten

Beim Hinzufügen von Medien (Bilder, Icons, Grafiken, Sounds etc.) bitte unbedingt:

- nur Material verwenden, das rechtlich genutzt werden darf  
- die jeweilige Lizenz prüfen (z. B. Creative Commons)  
- erforderliche Attributions korrekt im README und ggf. im Impressum ergänzen  

Im Zweifel lieber auf Open-Source-/CC0-Material zurückgreifen oder selbst erstellte Assets verwenden.

### Lewakas Captcha Bilder
Aktuell gibt es leider kaum Bilder für das Captcha - jede Ergänzung ist willkommen!

Best Practice in diesem Projekt: **Ordner + Manifest**.

- Manifest: `img/captcha/lewakas/manifest.json`
- Basisordner: `img/captcha/lewakas/`
- Empfohlene Struktur:
  - `img/captcha/lewakas/real/` (echte Lewakas-Bilder)
  - `img/captcha/lewakas/fake/` (falsche Bilder)

Die Zuordnung erfolgt über Ordnernamen:

1. Über Ordnernamen:
- Pfade mit `/real/` werden als korrekt gewertet
- Pfade mit `/fake/` werden als falsch gewertet
- Bereits **1 Bild pro Ordner** reicht. Die App wiederholt Bilder automatisch, bis das Captcha-Grid voll ist.

Beispiel `manifest.json`:

```json
{
  "basePath": "img/captcha/lewakas",
  "files": [
    "real/lewakas-01.jpg",
    "real/lewakas-02.jpg",
    "fake/ned-01.jpg",
    "fake/ned-02.jpg"
  ]
}
```


## Attributions 

### Verwendete Bilder
lewakas-01.jpg
- https://commons.wikimedia.org/wiki/File:Leberk%C3%A4sesemmel.jpg
- Kobako, CC BY-SA 2.5 <https://creativecommons.org/licenses/by-sa/2.5>, via Wikimedia Commons
