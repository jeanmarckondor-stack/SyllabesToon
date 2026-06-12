package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func main() {
	port := flag.String("port", "8000", "port HTTP local")
	root := flag.String("root", ".", "dossier a servir")
	flag.Parse()

	rootPath, err := filepath.Abs(*root)
	if err != nil {
		log.Fatalf("root invalide: %v", err)
	}

	info, err := os.Stat(rootPath)
	if err != nil {
		log.Fatalf("root inaccessible: %v", err)
	}
	if !info.IsDir() {
		log.Fatalf("root n'est pas un dossier: %s", rootPath)
	}

	address := "localhost:" + *port
	fmt.Println("SyllabesToon server")
	fmt.Println("root:", rootPath)
	fmt.Printf("http://localhost:%s/index.html\n", *port)
	fmt.Printf("http://localhost:%s/teacher-manager.html\n", *port)

	handler := http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		serveStatic(response, request, rootPath)
	})

	if err := http.ListenAndServe(address, handler); err != nil {
		log.Fatal(err)
	}
}

func serveStatic(response http.ResponseWriter, request *http.Request, rootPath string) {
	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		http.Error(response, "Methode non autorisee", http.StatusMethodNotAllowed)
		return
	}

	requestPath := request.URL.Path
	if requestPath == "/" {
		requestPath = "/index.html"
	}

	cleanPath := path.Clean("/" + requestPath)
	relativePath := strings.TrimPrefix(cleanPath, "/")
	filePath := filepath.Join(rootPath, filepath.FromSlash(relativePath))

	if !isInsideRoot(rootPath, filePath) {
		http.Error(response, "Chemin interdit", http.StatusForbidden)
		return
	}

	file, err := os.Open(filePath)
	if err != nil {
		http.NotFound(response, request)
		return
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil || info.IsDir() {
		http.NotFound(response, request)
		return
	}

	http.ServeContent(response, request, info.Name(), info.ModTime(), file)
}

func isInsideRoot(rootPath string, filePath string) bool {
	relativePath, err := filepath.Rel(rootPath, filePath)
	if err != nil {
		return false
	}

	return relativePath == "." || (!strings.HasPrefix(relativePath, ".."+string(filepath.Separator)) && relativePath != "..")
}
