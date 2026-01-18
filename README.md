# Bitburner Hacking System

Willkommen auf meiner Spielwiese mit Bitburner-Skripten. Die Skripte sind in der spielinternen Sprache Netscript geschrieben, was quasi JavaScript entspricht. Dieses Repo dient hauptsächlich dazu, meine Fortschritte festzuhalten und beim nächsten Neustart die Skripte automatisch parat zu haben.

Wenn du das Spiel selbst mal ausprobieren möchtest, klicke doch einfach auf einen der folgenden Links:

- [Bitburner auf Steam](https://store.steampowered.com/app/1812820/Bitburner/)
- [Bitburner im Browser](https://bitburner-official.github.io/)

## Initalisierung aus dem Repo

1. Lade das Skript namens `git-init.js` von GitHub, indem du die folgende Zeile im Bitburner (also Spielinternen) Terminal ausführst:

    ```
    wget https://raw.githubusercontent.com/ego-tsioge/bitburner-scripts/main/bitburner-home/git-init.js git-init.js
    ```

2. Starte danach das Skript mit `run git-init.js`.
   Dieses Skript lädt automatisch dieses Repo auf den Home Server (im Spiel).

3. Mit `run script.js` wird das Hauptmodul gestartet. TODO: dieses script erstellen

## Struktur

um den Homeserver in Bitburner etwas übersichtlich zu halten (immerhin kamen durch den spielfortschritt manchmal dateien dazu), werden die meisten scripte in Unterordnern abgelegt:

```
bitburner-home/     # entspricht dem Home-Verzeichnis im Spiel
├── git-init.js     # Script zum Kopieren der Repository-Dateien
├── src/            # Alle weiteren Skripte
│   ├── bin.*.js    # Ausführbare Operationen wie hack, grow & weaken
│   ├── mod.*.js    # Module für das Hauptprogramm
│   ├── lib.*.js    # Bibliotheken
│   └── util.*.js   # tools die sinnvoll sein könnten
├── saves/          # nicht Spielrelevant - hier leigen ein paar alte Spielstände
├── types/          # nicht Spielrelevant, hier kommen Type-Definitionen rein, die die IDE
                    # unterstützen sollen

```

### Type-Definitionen

Die JavaScript-Dateien referenzieren Type-Definitionen, um IntelliSense in VS Code zu unterstützen – z.B. für Code Completion beim `NS`-Objekt.

Bei der Übertragung ins Spielverzeichnis **werden Type-Definitionen am Dateianfang entfernt**, damit der spielinterne Editor in Bitburner seine eigene Definition für das `NS`-Objekt nutzt. **Hinweis:** _Zeilennummern in Fehlermeldungen des Spiels stimmen dadurch nicht mit dem Quellcode überein._
In der IDE kommt eine angepasste Version von [bitburner-connector](https://marketplace.visualstudio.com/items?itemName=hexnaught.vscode-bitburner-connector) zum Einsatz. Bei der `git-init.js` sorgt die Funktion `removeTypeDefinitions` dafür.

### Präfixe

die Verwendung der Präfixe ist so geplant:
| Präfix | Aufruf | Beschreibung |
|----------|----------------|-------------------------------------------------------|
| `bin.*` | exec | Atomare Operationen (hack, grow, weaken) |
| `mod.*` | exec/spawn | Module, die vom Scheduler gesteuert werden |
| `lib.*` | import | Wiederverwendbare Bibliotheken |
| `util.*` | Terminal | Eigenständige Hilfsskripte (Monitor, Tasks einreihen) |

Skripte ohne Präfix (z.B. `git-init.js`) sind eigenständige Entry Points.

## Inspirationen

Wichtige Anmerkung: Was du hier siehst, ist größtenteils von anderen kopiert.
Inspirationen gab es bei:

- https://github.com/jenheilemann/bitburner-scripts/blob/main/README.md
- https://www.youtube.com/watch?v=85-A4rOJr5A&list=PLbUKWaoZ7R0gWs0RBUUAzpXH_D8QKT1Fs&index=9
- https://www.reddit.com/r/Bitburner/
- https://quacksouls.github.io/lyf/hello_README/
- https://github.com/d0sboots/bitburner
- https://github.com/jjclark1982/bitburner-scripts/
