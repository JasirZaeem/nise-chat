package dist

import (
	"embed"
	"io/fs"
)

//go:embed all:nise-client/dist/*
var DistDir embed.FS

// DistDirFS is a file system view of the embedded nise-client/dist directory.
var DistDirFS, _ = fs.Sub(DistDir, "nise-client/dist")
