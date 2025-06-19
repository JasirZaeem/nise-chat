package main

import (
	"encoding/base32"
	"fmt"
	"github.com/google/uuid"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/ghupdate"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/pocketbase/pocketbase/tools/hook"
	"log"
	"net/http"
	dist "nise"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	app := NewApplication()

	// ---------------------------------------------------------------
	// Optional plugin flags:
	// ---------------------------------------------------------------

	var hooksDir string
	app.PB.RootCmd.PersistentFlags().StringVar(
		&hooksDir,
		"hooksDir",
		"",
		"the directory with the JS PB hooks",
	)

	var hooksWatch bool
	app.PB.RootCmd.PersistentFlags().BoolVar(
		&hooksWatch,
		"hooksWatch",
		true,
		"auto restart the PB on pb_hooks file change; it has no effect on Windows",
	)

	var hooksPool int
	app.PB.RootCmd.PersistentFlags().IntVar(
		&hooksPool,
		"hooksPool",
		15,
		"the total prewarm goja.Runtime instances for the JS PB hooks execution",
	)

	var migrationsDir string
	app.PB.RootCmd.PersistentFlags().StringVar(
		&migrationsDir,
		"migrationsDir",
		"",
		"the directory with the user defined migrations",
	)

	var automigrate bool
	app.PB.RootCmd.PersistentFlags().BoolVar(
		&automigrate,
		"automigrate",
		true,
		"enable/disable auto migrations",
	)

	var publicDir string
	app.PB.RootCmd.PersistentFlags().StringVar(
		&publicDir,
		"publicDir",
		defaultPublicDir(),
		"the directory to serve static files",
	)

	var indexFallback bool
	app.PB.RootCmd.PersistentFlags().BoolVar(
		&indexFallback,
		"indexFallback",
		true,
		"fallback the request to index.html on missing static path, e.g. when pretty urls are used with SPA",
	)

	app.PB.RootCmd.ParseFlags(os.Args[1:])

	// ---------------------------------------------------------------
	// Plugins and hooks:
	// ---------------------------------------------------------------

	// load jsvm (pb_hooks and pb_migrations)
	jsvm.MustRegister(app.PB, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      hooksDir,
		HooksWatch:    hooksWatch,
		HooksPoolSize: hooksPool,
	})

	// migrate command (with js templates)
	migratecmd.MustRegister(app.PB, app.PB.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  automigrate,
		Dir:          migrationsDir,
	})

	// GitHub selfupdate
	ghupdate.MustRegister(app.PB, app.PB.RootCmd, ghupdate.Config{})

	// ---------------------------------------------------------------
	// Routes
	// ---------------------------------------------------------------

	app.PB.OnFileDownloadRequest().BindFunc(func(e *core.FileDownloadRequestEvent) error {
		if strings.HasSuffix(e.ServedName, ".js") || strings.HasSuffix(e.ServedName, ".mjs") {
			e.Request.Header.Set("Content-Type", "text/javascript")
		}

		return e.Next()
	})

	app.PB.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// POST /api/threads, create a new thread with the first message
		se.Router.POST("/api/threads", app.newThreadHandler).Bind(apis.RequireAuth())

		// POST /api/threads/{threadId}/messages, create a new message in an existing thread
		se.Router.POST("/api/threads/{threadId}/messages", app.newMessageInThreadHandler).Bind(apis.RequireAuth())

		// PATCH /api/threads/{threadId}/messages/{messageId}, update an existing message
		se.Router.PATCH("/api/messages/{messageId}", app.updateMessageInThreadHandler).Bind(apis.RequireAuth())

		// POST /api/threads/{threadId}/messages/{messageId}/regenerate, regenerate an existing message in a thread
		se.Router.POST("/api/threads/{threadId}/messages/{messageId}/regenerate", app.regenerateMessageInThreadHandler).Bind(apis.RequireAuth())

		// GET /api/messages/{messageId}/stream, stream the content of a message in a thread
		se.Router.GET("/api/messages/{messageId}/stream", app.streamMessageHandler).Bind(apis.RequireAuth())

		// GET /api/key{keyId}/info, get the info for a specific key
		se.Router.GET("/api/key/{keyId}/info", app.getKeyInfoHandler).Bind(apis.RequireAuth())

		// GET /api/threads/search, search for threads
		se.Router.GET("/api/threads/search", app.searchThreadsHandler).Bind(apis.RequireAuth())

		return se.Next()
	})

	app.PB.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			if !e.Router.HasRoute(http.MethodGet, "/{path...}") {
				e.Router.GET("/{path...}", apis.Static(dist.DistDirFS, true)).Bind(apis.Gzip())
			}

			return e.Next()
		},
		Priority: 100, // execute as latest as possible to allow users to provide their own route
	})

	// static route to serves files from the provided public dir
	// (if publicDir exists and the route path is not already defined)
	app.PB.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			if !e.Router.HasRoute(http.MethodGet, "/{path...}") {
				e.Router.GET("/{path...}", apis.Static(os.DirFS(publicDir), indexFallback))
			}

			return e.Next()
		},
		Priority: 999, // execute as latest as possible to allow users to provide their own route
	})

	if err := app.PB.Start(); err != nil {
		log.Fatal(err)
	}
}

// the default pb_public dir location is relative to the executable
func defaultPublicDir() string {
	if strings.HasPrefix(os.Args[0], os.TempDir()) {
		// most likely ran with go run
		return "./pb_public"
	}

	return filepath.Join(os.Args[0], "../pb_public")
}

type UUIDv7b32 uuid.UUID

// Crockford's base32
var bas32UUIDencoding = base32.NewEncoding("0123456789abcdefghjkmnpqrstvwxyz")

func (u UUIDv7b32) String() string {
	return bas32UUIDencoding.WithPadding(base32.NoPadding).EncodeToString(u[:])
}
func NewUUIDv7b32() (UUIDv7b32, error) {
	uuidv7, err := uuid.NewV7()
	if err != nil {
		return UUIDv7b32{}, fmt.Errorf("failed to generate UUIDv7: %w", err)
	}
	return UUIDv7b32(uuidv7), nil
}
