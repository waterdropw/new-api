package common

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/gin-contrib/static"
)

// Credit: https://github.com/gin-contrib/static/issues/19

type embedFileSystem struct {
	http.FileSystem
}

func (e *embedFileSystem) Exists(prefix string, p string) bool {
	cleanPath := strings.TrimPrefix(p, "/")
	if cleanPath == "" {
		return false
	}
	f, err := e.FileSystem.Open(cleanPath)
	if err == nil {
		defer f.Close()
		if fi, statErr := f.Stat(); statErr == nil && fi.IsDir() {
			// Try directory index
			indexPath := path.Join(cleanPath, "index.html")
			if idx, idxErr := e.FileSystem.Open(indexPath); idxErr == nil {
				_ = idx.Close()
				return true
			}
			return false
		}
		return true
	}
	// Fallback: try index.html under this path (for directory-like routes)
	indexPath := path.Join(cleanPath, "index.html")
	if idx, idxErr := e.FileSystem.Open(indexPath); idxErr == nil {
		_ = idx.Close()
		return true
	}
	return false
}

func (e *embedFileSystem) Open(name string) (http.File, error) {
	if name == "/" {
		// This will make sure the index page goes to NoRouter handler,
		// which will use the replaced index bytes with analytic codes.
		return nil, os.ErrNotExist
	}
	cleanName := strings.TrimPrefix(name, "/")
	if cleanName == "" {
		return nil, os.ErrNotExist
	}
	f, err := e.FileSystem.Open(cleanName)
	if err == nil {
		if fi, statErr := f.Stat(); statErr == nil && fi.IsDir() {
			_ = f.Close()
			// Serve directory index file
			return e.FileSystem.Open(path.Join(cleanName, "index.html"))
		}
	}
	return f, err
}

func EmbedFolder(fsEmbed embed.FS, targetPath string) static.ServeFileSystem {
	efs, err := fs.Sub(fsEmbed, targetPath)
	if err != nil {
		panic(err)
	}
	return &embedFileSystem{
		FileSystem: http.FS(efs),
	}
}
