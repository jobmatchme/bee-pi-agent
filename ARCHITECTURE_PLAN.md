# Fabee PI Agent – geplanter Architektur- und Umsetzungsstand

_Status: 2026-04-20_

Dieses Dokument fasst den aktuell gemeinsam erarbeiteten Stand für die Einführung von `fabee-pi-agent` in `bici` zusammen.

---

## Zielbild

`fabee-pi-agent` soll als zusätzlicher Bee-Worker in `bici` laufen, **parallel** zum bestehenden `bee-pi-agent` und **ohne** diesen zu ersetzen.

Der neue Worker soll:

- als eigener Pod / eigenes Deployment laufen
- eine eigene `bee-worker-sidecar`-Instanz haben
- über ein eigenes `workerSubject` angebunden sein
- im Namespace `ai-agents` laufen
- sich operativ stark am bestehenden `bee-pi-agent` orientieren
- aber einen **eigenen Chart** und ein **eigenes Image** bekommen

---

## Bereits entschiedene Punkte

## 1. Pod- und Runtime-Architektur

Fest entschieden:

- `fabee-pi-agent` ersetzt den bestehenden `bee-pi-agent` **nicht**.
- `fabee-pi-agent` läuft **parallel** zum bestehenden Agenten.
- `fabee-pi-agent` bekommt einen **eigenen Pod / eigenes Deployment**.
- Der Pod besteht aus:
  - `fabee-pi-agent`
  - eigener `bee-worker-sidecar`-Instanz
- Architekturannahme bleibt:
  - **1 Sidecar : 1 Worker**

Begründung:

- saubere operative Trennung
- einfacheres Debugging
- separates Deployment und spätere Weiterentwicklung
- gleiches Sidecar-Modell wie beim bestehenden `bee-pi-agent`

---

## 2. Zielumgebung

Fest entschieden:

- Ziel-Cluster: `bici`
- Ziel-Namespace: `ai-agents`

Wichtige Präzisierung:

- Ursprünglich wurde ein eigener Namespace erwogen.
- Nach Abgleich mit dem realen Cluster-Setup wurde entschieden, `fabee-pi-agent` in `ai-agents` zu betreiben, also dort, wo auch der bestehende `bee-pi-agent` sichtbar ist.
- Die Trennung erfolgt damit **nicht über einen separaten Namespace**, sondern über:
  - eigenes Deployment
  - eigenen Pod
  - eigenes Subject
  - eigene Ressourcennamen
  - eigenen Chart

---

## 3. Routing / Worker Subject

Aktueller Arbeitsstand:

- bisheriger Arbeitswert: `fabee.agent.pi.default`

Wichtige neue Einordnung:

- Dieser Subject-Wert sollte **nicht als final fachlich richtig beschlossen** betrachtet werden.
- Aus Architektur-Sicht sollten NATS-Subjects möglichst **fachlich orientiert** gewählt werden und nicht primär danach, wem der Agent gehört oder auf welchem technischen Image er läuft.
- Die Subject-Hierarchie kann später für Broadcasts und fachliche Gruppierungen relevant werden.

Daraus folgt:

- `fabee.agent.pi.default` bleibt vorerst ein **provisorischer Arbeitswert**.
- Die endgültige Subject-Strategie sollte nochmals fachlich mit Blick auf zukünftige Agenten und mögliche Broadcast-/Hierarchie-Muster überprüft werden.

---

## 4. Auth / Modellzugang

Fest entschieden:

- Für den ersten Schritt wird das bestehende Secret `bee-pi-agent-auth` mitverwendet.
- Es wird zunächst **keine eigene neue `auth.json`** für `fabee-pi-agent` angelegt.

Zusätzliche Management-Rückmeldung:

- Parallel dazu soll daran gearbeitet werden, über Svenja einen **Pro-Account / zentralisiertes Company-Auth** bereitzustellen.
- Das aktuelle Wiederverwenden des bestehenden Auth-Secrets ist daher als pragmatische Zwischenlösung zu verstehen.

Modellkonfiguration:

- `BEE_PI_AGENT_MODEL_PROVIDER=openai-codex`
- `BEE_PI_AGENT_MODEL_ID=gpt-5.4`

---

## 5. State- und Workspace-Modell

Fest entschieden:

- `fabee-pi-agent` ist im ersten Schritt **nur Runtime**, kein Worker mit vorab geklontem Arbeits-Repo.
- Es wird **kein Git-Repo** in den Workspace geklont.
- Es wird **kein `repo-bootstrap`** verwendet.
- Es wird **kein Git-SSH-Secret** benötigt.
- Workspace-Modell:
  - `emptyDir`
  - also **temporär**

Wichtige neue Einordnung:

- Aus fachlicher Sicht wurde zurückgespielt, dass der Bereich **State / Workspace / Repo-Bereitstellung vermutlich einen großen Hebel für einen wirklich gut nutzbaren Agenten** darstellt.
- Das bisherige bee-pi-agent-Setup wird hier ausdrücklich **nicht** als gutes Endbild betrachtet.
- Entsprechend sollte an diesem Bereich **früh weitergearbeitet** werden und es sollten perspektivisch **verschiedene Konfigurationsmöglichkeiten** unterstützt werden.

Daraus folgt:

- Das aktuelle temporäre `emptyDir`-Modell ist als **Startkonfiguration**, nicht als Zielarchitektur, zu verstehen.

Zusätzliche State-Entscheidung:

- `BEE_PI_AGENT_STATE_DIR=.fabee-pi-agent`

Wichtige Erkenntnis aus dem bestehenden Setup:

- `.bee-pi-agent` im bestehenden Worker ist **kein Arbeits-Repository**, sondern ein State-/Session-Verzeichnis.
- Analog dazu soll `fabee-pi-agent` seinen eigenen State unter `.fabee-pi-agent` führen.

---

## 6. Image- und Build-Strategie

Fest entschieden:

- `fabee-pi-agent` bekommt ein **eigenes Image**.
- Die primäre Ziel-Registry ist im ersten Schritt **GHCR**.
- Veröffentlichungen sollen weiterhin über **GitHub Actions** laufen.
- Release-Auslöser bleiben zunächst **Git-Tags** (`v*`).
- Für das Image-Tagging reicht zunächst ein **reiner Versionstag**.
- `latest` sowie zusätzliche Dev-/SHA-Tags sind aktuell nicht vorgesehen.
- Das Laufzeit-Image wird im ersten Schritt **direkt aus dem Repo-Quellcode** gebaut.
- Ein vorgeschaltetes npm-Publishing ist für den Container-Release **nicht erforderlich**.
- Optional kann ein nachgelagerter Helm-Chart-Publish-Flow weiter an den GHCR-Release gekoppelt bleiben, solange das Chart noch in diesem Repo liegt.

Laufzeit-Image-Ziel:

- `ghcr.io/fabianmewes-jm/fabee-pi-agent:<tag>`

Wichtige Referenz zum bestehenden `bee-pi-agent`:

- Der bestehende `bee-pi-agent` wird aktuell über einen GHCR-Image-Flow betrieben.
- Dort ist der Veröffentlichungsweg heute noch stärker an npm und Helm gekoppelt.
- Auch wenn im Cluster ein Pull-Secret namens `nexus-registry-creds` verwendet wird, zeigt das tatsächliche `image.repository` derzeit auf GHCR.

Daher wurde entschieden:

- `fabee-pi-agent` orientiert sich beim Registry-Ziel weiterhin am GHCR-basierten Referenzfall.
- Der Release-Flow wird jedoch für den Container bewusst vereinfacht auf:
  - `Git-Tag -> GHCR image`
- Damit wird die unnötige Abhängigkeit von npm aus dem Container-Release entfernt.

Zusätzliche Management-Rückmeldung:

- GHCR ist vor allem dann unkritisch, wenn die Images **keine internen JobMatch-Daten** enthalten.
- Sobald interne Inhalte / vertrauliche Artefakte in Images landen würden, müsste der Verteilweg voraussichtlich stärker Richtung **interner Nexus** gedacht werden.
- Für den aktuellen Stand klingt GHCR weiterhin plausibel, die genaue Abgrenzung sollte aber bewusst im Blick behalten werden.

---

## 7. Repo- und Deployment-Repo-Zusammenspiel

Nach Analyse von `k8s-infra` und `k8s-clusters-dev` ist das Zusammenspiel wie folgt verstanden:

### `fabee-pi-agent` Repo

Enthält:

- den eigentlichen Worker-Code
- das Dockerfile / den Image-Build-Kontext
- später die Worker-spezifische Build-/Release-Logik

### `k8s-infra`

Enthält:

- die gemeinsame Plattform-Schicht für `ai-agents`
- die Helm-Charts
- aktuell den bestehenden `bee-pi-agent`-Chart

### `k8s-clusters-dev`

Enthält:

- die konkreten `HelmRelease`-Manifeste für `bici`
- also die cluster-spezifischen Agent-Instanzen

Flux-Modell:

- `k8s-infra` liefert die gemeinsame Plattform- und Chart-Schicht
- `k8s-clusters-dev` liefert die konkreten Deployments / Releases für `bici`

---

## 8. Chart-Strategie

Fest entschieden:

- `fabee-pi-agent` soll **nicht** den generischen `bee-pi-agent`-Chart direkt weiterverwenden.
- Stattdessen soll ein **eigener Chart** angelegt werden.

Geplanter Ort:

- `k8s-infra/k8s/ai-agents/charts/fabee-pi-agent`

Geplante Herangehensweise:

- initial als **nahezu 1:1 Ableitung / Kopie** des bestehenden `bee-pi-agent`-Charts
- danach gezielte Anpassungen an `fabee`

Begründung:

- maximale Nähe zur funktionierenden Referenz
- trotzdem klare Eigenständigkeit des neuen Workers
- bessere spätere Weiterentwicklung ohne verdeckte Kopplung an den `bee-pi-agent`-Chart

---

## 9. HelmRelease-Strategie in `k8s-clusters-dev`

Fest entschieden:

- Der bisherige kleine `fabee`-Release soll konsistent umbenannt werden zu `fabee-pi-agent`.

Geplanter Zielpfad:

- `k8s-clusters-dev/clusters/bici/ai-agents/fabee-pi-agent-helmrelease.yaml`

Der Release soll:

- klein bleiben
- auf den neuen `fabee-pi-agent`-Chart in `k8s-infra` zeigen
- ein eigenes Image referenzieren
- weiter die minimalen agent-spezifischen Werte setzen

---

## Bereits absehbare Default-Anpassungen im neuen Chart

Diese Änderungen gegenüber dem bestehenden `bee-pi-agent`-Chart sind bereits als naheliegende Defaults identifiziert:

- Chart-Name: `fabee-pi-agent`
- Default `agent.name`: `fabee-pi-agent`
- Default `image.repository`: `ghcr.io/fabianmewes-jm/fabee-pi-agent`
- Default `runtime.stateDir`: `.fabee-pi-agent`
- Default `config.env.BEE_PI_AGENT_MODEL_PROVIDER`: `openai-codex`
- Default `config.env.BEE_PI_AGENT_MODEL_ID`: `gpt-5.4`

Naheliegend unverändert zu übernehmen:

- Sidecar-Image-Mechanik
- Auth-Bootstrap-Mechanik
- `runtimeHome.enabled`
- `workspace.type: emptyDir`
- Pull-Secret-Muster (`nexus-registry-creds`), solange GHCR-Pulls damit im Cluster funktionieren
- Socket- und Sidecar-Kommunikationsmodell

---

## Noch offen / noch zu entscheiden

## A. Helm-/Chart-Konfiguration konkretisieren

Noch offen:

- finaler Inhalt des neuen `fabee-pi-agent`-Charts
- ob neben den bereits identifizierten Defaults noch weitere Werte angepasst werden sollen
- finaler Inhalt des neuen `fabee-pi-agent-helmrelease.yaml`
- wie explizit `image.repository` und `image.tag` im HelmRelease gesetzt werden sollen

---

## B. Registry- und CI/CD-Flow definieren

Weitgehend entschieden:

- primäre Ziel-Registry: `ghcr.io`
- Veröffentlichungen weiterhin über GitHub Actions
- Release-Auslöser zunächst nur über Git-Tags (`v*`)
- Runtime-Image-Flow direkt aus dem Repo-Quellcode nach GHCR
- kein vorgeschalteter npm-Publish für den Container-Release
- Image-Tagging zunächst nur über den Versionstag
- Helm-Chart-Publishing kann übergangsweise nach dem GHCR-Release weiterlaufen, solange das Chart noch in diesem Repo liegt

Noch offen:

- welche GitHub-Secrets / Credentials für GHCR und ggf. Helm-Chart-Publishing tatsächlich benötigt werden
- wie genau das Helm-Chart-Publishing übergangsweise gehandhabt wird, obwohl Chart-Ownership fachlich eher in `k8s-infra` liegt
- ob und wann der Helm-Chart-Publish-Teil vollständig in `k8s-infra` verlagert wird

Zusätzliche Management-Rückmeldung:

- Der bisherige Eindruck ist, dass auch für `fabee-pi-agent` der Build-/Publish-Flow **wie bisher über GitHub** abbildbar sein sollte.

---

## C. GHCR-Pull im Cluster absichern

Noch offen:

- ob `nexus-registry-creds` für `ghcr.io/fabianmewes-jm/fabee-pi-agent` im Cluster tatsächlich funktioniert
- falls nicht, welches Pull-Secret bzw. welches Registry-Setup in `bici` für das neue Image nötig ist

Wichtig:

- Beim bestehenden `bee-pi-agent` zeigt das Image auf GHCR.
- Im Cluster ist aber `nexus-registry-creds` konfiguriert.
- Diese operative Kombination muss für `fabee-pi-agent` konkret verifiziert werden.

---

## D. Secrets und Runtime-Konfiguration final dokumentieren

Teilweise entschieden, aber noch nicht als komplette Betriebsdoku ausgearbeitet:

- `bee-pi-agent-auth` als Auth-Secret
- `BEE_PI_AGENT_MODEL_PROVIDER=openai-codex`
- `BEE_PI_AGENT_MODEL_ID=gpt-5.4`
- `BEE_PI_AGENT_STATE_DIR=.fabee-pi-agent`

Noch als Runbook zu konkretisieren:

- wie das Secret im Zielcluster geprüft / verwaltet wird
- welche minimalen Overrides im Release gesetzt werden sollen
- welche Defaults nur im Chart liegen und welche bewusst im Release überschrieben werden

---

## E. Dokumentation / Runbook

Noch offen:

- konkrete Build-Anleitung
- konkrete Chart-/Release-Anleitung
- konkrete GitOps-Schritte in `k8s-infra` und `k8s-clusters-dev`
- Smoke-Test nach erstem Deploy

---

## Nächste sinnvolle Arbeitsschritte

1. **`TODO-042edbbf` weiter schärfen**
   - finaler Zuschnitt des neuen `fabee-pi-agent`-Charts
   - finaler Zuschnitt des neuen `fabee-pi-agent-helmrelease.yaml`

2. **`TODO-c74c3ce9` bearbeiten**
   - GHCR-Build-/Push-Flow für `fabee-pi-agent` definieren
   - Versionierungs- und Tagging-Strategie festlegen

3. **`TODO-fcc48af9` konkretisieren**
   - Secrets und Runtime-Konfiguration als vollständigen Betriebsstand festhalten

4. **`TODO-afe27391` abschließen**
   - klare Betriebs- und Deploy-Dokumentation schreiben

---

## Kurzfazit

Der geplante Stand ist inzwischen klar:

- `fabee-pi-agent` wird ein **eigener Bee-Worker** in `bici`
- mit **eigenem Pod**, **eigenem Sidecar**, **eigenem Subject**, **eigenem Chart** und **eigenem Image**
- operativ stark am `bee-pi-agent` orientiert
- aber bewusst als eigenständige Komponente aufgebaut
- zunächst pragmatisch und zielorientiert:
  - GHCR-Image
  - GitHub-basierter Release-Flow
  - direkter Container-Release aus dem Repo per Git-Tag
  - nur Versionstag für Images
  - kein Arbeits-Repo im Workspace
  - temporärer Workspace

Die größten noch offenen Blöcke sind jetzt:

- finaler Chart-/HelmRelease-Zuschnitt
- konkreter Build-/Publish-Flow
- Verifikation des Pull-/Registry-Verhaltens im Cluster
