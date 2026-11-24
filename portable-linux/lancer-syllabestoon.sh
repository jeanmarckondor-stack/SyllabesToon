#!/usr/bin/env bash
set -u

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" || exit 1
cd -- "$script_dir" || exit 1

url="http://localhost:8000/index.html"
server_pid=""

if [[ ! -f ./server ]]; then
    printf '%s\n' 'Le serveur Linux est absent. Contactez Jean-Marc.' >&2
    exit 1
fi
if [[ ! -x ./server ]]; then
    printf '%s\n' "Le serveur Linux n'est pas executable." 'Dans ce dossier, lancez : chmod +x server' >&2
    exit 1
fi

if ! command -v ss >/dev/null 2>&1; then
    printf '%s\n' 'La commande standard ss est introuvable : verification du port impossible.' >&2
    exit 1
fi
if ! listeners="$(ss -H -ltn 'sport = :8000')"; then
    printf '%s\n' 'Impossible de verifier si le port 8000 est libre.' >&2
    exit 1
fi
if [[ -n "$listeners" ]]; then
    printf '%s\n' 'Le port 8000 est deja occupe. Fermez le serveur existant puis relancez SyllabesToon.' >&2
    exit 1
fi

cleanup() {
    local status=$?
    trap - EXIT
    if [[ -n "$server_pid" ]]; then
        if kill -0 "$server_pid" 2>/dev/null; then
            printf '\n%s\n' 'Arret du serveur SyllabesToon...'
            kill -TERM "$server_pid" 2>/dev/null || true
        fi
        wait "$server_pid" 2>/dev/null || true
    fi
    exit "$status"
}

# All termination paths clean up only the child started by this launcher.
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

server_responds() (
    exec 3<>/dev/tcp/localhost/8000 || exit 1
    printf 'GET /index.html HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3 || exit 1
    IFS= read -r -t 1 response <&3 || exit 1
    [[ "$response" == HTTP/*" 200 "* ]]
)

printf '%s\n' 'Demarrage de SyllabesToon...'
./server --port 8000 --root . &
server_pid=$!

ready=false
for ((attempt = 0; attempt < 20; attempt++)); do
    if ! kill -0 "$server_pid" 2>/dev/null; then
        printf '%s\n' 'Le serveur ne demarre pas. Consultez le message affiche ci-dessus.' >&2
        exit 1
    fi
    if server_responds 2>/dev/null && kill -0 "$server_pid" 2>/dev/null; then
        ready=true
        break
    fi
    sleep 0.25
done
if [[ "$ready" != true ]]; then
    printf '%s\n' 'Le serveur ne repond pas. Verifiez que index.html est present puis relancez.' >&2
    exit 1
fi

printf '%s\n' "Jeu : $url" 'Espace enseignant : http://localhost:8000/teacher-manager.html'
printf '%s\n' "Gardez ce terminal ouvert pendant l'utilisation." 'Pour arreter : Ctrl+C ou fermer ce terminal.'
if ! command -v xdg-open >/dev/null 2>&1; then
    printf '%s\n' "xdg-open est introuvable. Ouvrez manuellement : $url" >&2
elif ! xdg-open "$url"; then
    printf '%s\n' "Impossible d'ouvrir le navigateur. Ouvrez manuellement : $url" >&2
fi

wait "$server_pid"
server_status=$?
server_pid=""
if [[ "$server_status" -ne 0 ]]; then
    printf '%s\n' "Le serveur SyllabesToon s'est arrete avec une erreur." >&2
fi
exit "$server_status"
