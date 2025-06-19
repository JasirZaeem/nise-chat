.PHONY: all client server clean

all: client server

client:
	@echo "Building React client..."
	cd nise-client && npm install && npm run build

server: client
	@echo "Building Go server..."
	go build -ldflags='-s' -trimpath -o=./nise ./cmd/nise-srv

clean:
	@echo "Cleaning build artifacts..."
	-rm -rf nise-client/node_modules nise-client/dist cmd/nise-srv/*.exe cmd/nise-srv/*.out
