#!/usr/bin/env bash
set -u

fail() {
    printf 'Erreur de creation du raccourci : %s\n' "$1" >&2
    exit 1
}

app_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)" || fail 'dossier application inaccessible.'
[[ -f "$app_dir/server" ]] || fail 'server est absent. Contactez Jean-Marc.'
[[ -f "$app_dir/lancer-syllabestoon.sh" ]] || fail 'lancer-syllabestoon.sh est absent.'
chmod u+x -- "$app_dir/server" "$app_dir/lancer-syllabestoon.sh" || fail 'permissions executables impossibles a appliquer.'

desktop_dir=""
if command -v xdg-user-dir >/dev/null 2>&1; then
    desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null)" || desktop_dir=""
fi
if [[ -z "$desktop_dir" ]]; then
    if [[ -d "$HOME/Bureau" ]]; then
        desktop_dir="$HOME/Bureau"
    else
        desktop_dir="$HOME/Desktop"
    fi
fi
[[ "$desktop_dir" == /* ]] || fail 'le chemin du bureau doit etre absolu.'
mkdir -p -- "$desktop_dir" || fail 'le dossier du bureau est inaccessible.'

desktop_file="$desktop_dir/SyllabesToon.desktop"
[[ ! -L "$desktop_file" ]] || fail 'SyllabesToon.desktop est un lien symbolique.'
[[ ! -d "$desktop_file" ]] || fail 'un dossier porte deja le nom SyllabesToon.desktop.'
temp_file="$(mktemp "$desktop_dir/.syllabestoon.XXXXXX")" || fail 'ecriture impossible sur le bureau.'
trap 'rm -f -- "$temp_file"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

desktop_value() {
    local value=$1
    value=${value//\\/\\\\}
    value=${value//$'\n'/\\n}
    value=${value//$'\r'/\\r}
    value=${value//$'\t'/\\t}
    printf '%s' "$value"
}

exec_argument() {
    local value=$1
    # Exec quoting is decoded after desktop-entry string escapes.
    value=${value//\\/\\\\}
    value=${value//\"/\\\"}
    value=${value//\`/\\\`}
    value=${value//\$/\\\$}
    value=${value//%/%%}
    desktop_value "$value"
}

if ! printf '%s\n' \
    '[Desktop Entry]' \
    'Version=1.0' \
    'Type=Application' \
    'Name=SyllabesToon' \
    'Comment=Ouvrir le jeu SyllabesToon' \
    "Exec=/bin/bash \"$(exec_argument "$app_dir/lancer-syllabestoon.sh")\"" \
    "Path=$(desktop_value "$app_dir")" \
    "Icon=$(desktop_value "$app_dir/assets/images/mascot.png")" \
    'Terminal=true' \
    'StartupNotify=false' \
    'Categories=Education;Game;' > "$temp_file"; then
    fail 'ecriture du fichier .desktop impossible.'
fi

chmod u+x -- "$temp_file" || fail 'le raccourci ne peut pas etre rendu executable.'
mv -f -- "$temp_file" "$desktop_file" || fail 'le raccourci ne peut pas etre installe.'

trusted=false
if command -v gio >/dev/null 2>&1 && command -v sha256sum >/dev/null 2>&1; then
    if checksum="$(sha256sum < "$desktop_file")"; then
        checksum=${checksum%% *}
        if gio set -t string "$desktop_file" metadata::xfce-exe-checksum "$checksum" 2>/dev/null; then
            trusted=true
        fi
    fi
fi

printf '%s\n' "Raccourci installe : $desktop_file" 'Pour lancer le jeu, double-cliquez sur SyllabesToon sur le bureau.'
if [[ "$trusted" != true ]]; then
    printf '%s\n' 'Si Xubuntu demande une autorisation, choisissez de faire confiance au lanceur ou de le rendre executable.'
fi
printf '%s\n' "Gardez le terminal ouvert pendant l'utilisation. Pour arreter : Ctrl+C ou fermer le terminal."
printf '%s\n' "Si vous deplacez le dossier de l'application, relancez cet installateur."
