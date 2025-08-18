#!/bin/bash

# NeverEverLand v007 Development Server Manager
# High-Performance Voxel System with TypeScript and Vite

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
VITE_PORT=8007
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="NeverEverLand v007 - Voxel Engine"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

print_header() {
    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}    $PROJECT_NAME${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════${NC}"
    echo ""
}

# Kill processes on specific port
kill_port() {
    local port=$1
    
    print_status "Checking for existing process on port $port..."
    
    # Method 1: Try lsof
    if command -v lsof &> /dev/null; then
        local pids=$(lsof -ti:$port 2>/dev/null)
        if [ ! -z "$pids" ]; then
            echo "$pids" | xargs -r kill -9 2>/dev/null
            print_success "Killed process(es) on port $port using lsof"
            sleep 1
            return
        fi
    fi
    
    # Method 2: Try fuser
    if command -v fuser &> /dev/null; then
        fuser -k $port/tcp 2>/dev/null && print_success "Killed process on port $port using fuser"
        sleep 1
        return
    fi
    
    # Method 3: Try netstat
    if command -v netstat &> /dev/null; then
        local pid=$(netstat -tlnp 2>/dev/null | grep ":$port" | awk '{print $7}' | cut -d'/' -f1)
        if [ ! -z "$pid" ]; then
            kill -9 $pid 2>/dev/null && print_success "Killed process (PID: $pid) using netstat"
            sleep 1
            return
        fi
    fi
    
    # Method 4: Try ss
    if command -v ss &> /dev/null; then
        local pid=$(ss -tlnp 2>/dev/null | grep ":$port" | grep -oP 'pid=\K\d+')
        if [ ! -z "$pid" ]; then
            kill -9 $pid 2>/dev/null && print_success "Killed process (PID: $pid) using ss"
            sleep 1
            return
        fi
    fi
    
    # Method 5: Nuclear option - find any process with the port number
    print_warning "Using nuclear option to find processes..."
    ps aux | grep -E "$port" | grep -v grep | grep -v "$0" | awk '{print $2}' | while read pid; do
        if [ ! -z "$pid" ]; then
            print_status "Checking PID $pid..."
            # Check if this process is actually using the port
            if ls -l /proc/$pid/fd 2>/dev/null | grep -q "socket"; then
                kill -9 $pid 2>/dev/null && print_success "Killed suspicious process (PID: $pid)"
            fi
        fi
    done
    sleep 1
}

# Kill Vite server
kill_vite_server() {
    print_status "Stopping Vite development server..."
    
    # First try to kill using the PID file
    if [ -f "$PROJECT_DIR/.vite.pid" ]; then
        local pid=$(cat "$PROJECT_DIR/.vite.pid" 2>/dev/null)
        if [ ! -z "$pid" ] && ps -p $pid > /dev/null 2>&1; then
            print_status "Killing process from PID file: $pid"
            kill -9 $pid 2>/dev/null
            sleep 1
        fi
    fi
    
    # Kill processes on the port
    kill_port $VITE_PORT
    
    # Kill any npm/node processes related to this project
    print_status "Cleaning up related processes..."
    
    # Find and kill processes with the project directory in their command
    ps aux | grep -E "node.*$PROJECT_DIR" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null
    ps aux | grep -E "npm.*$PROJECT_DIR" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null
    
    # Kill vite processes
    pkill -f "vite.*$VITE_PORT" 2>/dev/null
    pkill -f "vite.*$PROJECT_DIR" 2>/dev/null
    pkill -f "node.*vite.*$VITE_PORT" 2>/dev/null
    
    # Additional cleanup for processes that might be holding the port
    # Use fuser if available (more reliable)
    if command -v fuser &> /dev/null; then
        fuser -k $VITE_PORT/tcp 2>/dev/null
    fi
    
    # Clean up PID file and logs
    rm -f "$PROJECT_DIR/.vite.pid" 2>/dev/null
    
    # Give processes time to fully terminate
    sleep 1
    
    # Verify the port is free
    if check_port $VITE_PORT; then
        print_warning "Port $VITE_PORT still in use, attempting forceful cleanup..."
        # Try one more time with more aggressive approach
        fuser -k -KILL $VITE_PORT/tcp 2>/dev/null
        sleep 1
    fi
    
    print_success "Vite server stopped"
}

# Check if port is available
check_port() {
    local port=$1
    if command -v lsof &> /dev/null; then
        lsof -i:$port &>/dev/null
    elif command -v netstat &> /dev/null; then
        netstat -tln | grep -q ":$port "
    else
        curl -s http://localhost:$port &>/dev/null
    fi
    return $?
}

# Start Vite server
start_vite() {
    print_status "Starting Vite development server..."
    
    # Check if package.json exists
    if [ ! -f "$PROJECT_DIR/package.json" ]; then
        print_error "package.json not found in $PROJECT_DIR"
        return 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "$PROJECT_DIR/node_modules" ]; then
        print_warning "node_modules not found. Installing dependencies..."
        cd "$PROJECT_DIR"
        npm install
        if [ $? -ne 0 ]; then
            print_error "Failed to install dependencies"
            return 1
        fi
        print_success "Dependencies installed"
    fi
    
    # Check TypeScript compilation
    print_status "Checking TypeScript compilation..."
    cd "$PROJECT_DIR"
    npx tsc --noEmit 2>&1 | head -20
    
    # Start Vite in background
    print_status "Launching Vite server..."
    nohup npm run dev > "$PROJECT_DIR/vite.log" 2>&1 &
    local vite_pid=$!
    echo $vite_pid > "$PROJECT_DIR/.vite.pid"
    
    # Wait for server to start with spinner
    local count=0
    local max_attempts=30
    echo -n "  Waiting for server"
    while [ $count -lt $max_attempts ]; do
        if check_port $VITE_PORT; then
            echo ""
            print_success "Vite server started successfully!"
            print_info "URL: http://localhost:$VITE_PORT"
            print_info "PID: $vite_pid"
            return 0
        fi
        echo -n "."
        sleep 0.5
        count=$((count + 1))
    done
    
    echo ""
    print_error "Failed to start Vite server (timeout)"
    # Show last few lines of log for debugging
    if [ -f "$PROJECT_DIR/vite.log" ]; then
        print_warning "Last log entries:"
        tail -5 "$PROJECT_DIR/vite.log"
    fi
    return 1
}

# Open browser
open_browser() {
    local url="http://localhost:$VITE_PORT"
    
    print_status "Opening browser..."
    
    # Try different commands to open browser
    if command -v xdg-open &> /dev/null; then
        xdg-open "$url" 2>/dev/null &
    elif command -v open &> /dev/null; then
        open "$url" 2>/dev/null &
    elif command -v start &> /dev/null; then
        start "$url" 2>/dev/null &
    else
        print_info "Please open your browser and navigate to: $url"
    fi
}

# Show server status
show_status() {
    print_header
    
    # Check Vite
    if check_port $VITE_PORT; then
        print_success "Vite server is running on port $VITE_PORT"
        echo "  📍 URL: http://localhost:$VITE_PORT"
        
        # Show PID file info
        if [ -f "$PROJECT_DIR/.vite.pid" ]; then
            local pid=$(cat "$PROJECT_DIR/.vite.pid")
            echo "  🔧 PID from file: $pid"
            # Check if process is actually running
            if ps -p $pid > /dev/null 2>&1; then
                local mem=$(ps -o rss= -p $pid | awk '{printf "%.1f", $1/1024}')
                echo "  💾 Memory: ${mem}MB"
                echo "  ✅ Process verified"
            else
                echo "  ⚠️  Process not found (stale PID file)"
            fi
        else
            echo "  ⚠️  No PID file found"
        fi
        
        # Try to find actual process
        echo ""
        print_info "Searching for Vite processes..."
        local vite_procs=$(ps aux | grep -E "(vite|node.*$VITE_PORT)" | grep -v grep | grep -v "$0")
        if [ ! -z "$vite_procs" ]; then
            echo "$vite_procs" | while read line; do
                echo "  → $line" | cut -c1-120
            done
        else
            echo "  No Vite processes found"
        fi
    else
        print_error "Vite server is not running on port $VITE_PORT"
        echo "  Run '$0 start' to start the server"
    fi
    
    echo ""
    print_info "Project: $PROJECT_DIR"
    print_info "TypeScript: $(npx tsc --version 2>/dev/null || echo 'Not installed')"
    print_info "Vite: $(npx vite --version 2>/dev/null || echo 'Not installed')"
    print_info "Node: $(node --version 2>/dev/null || echo 'Not installed')"
}

# Show logs
show_logs() {
    if [ -f "$PROJECT_DIR/vite.log" ]; then
        print_info "Showing Vite server logs (Press Ctrl+C to exit):"
        echo "${CYAN}───────────────────────────────────────────────────${NC}"
        tail -f "$PROJECT_DIR/vite.log"
    else
        print_error "Log file not found: $PROJECT_DIR/vite.log"
        print_info "Start the server first with: $0 start"
    fi
}

# Build for production
build_production() {
    print_header
    print_status "Building for production..."
    
    cd "$PROJECT_DIR"
    
    # Run TypeScript compiler
    print_status "Type checking with TypeScript..."
    npx tsc
    if [ $? -ne 0 ]; then
        print_error "TypeScript compilation failed"
        return 1
    fi
    print_success "TypeScript check passed"
    
    # Run Vite build
    print_status "Building with Vite..."
    npm run build
    if [ $? -eq 0 ]; then
        print_success "Production build complete!"
        print_info "Output directory: $PROJECT_DIR/dist"
        print_info "To preview: $0 preview"
    else
        print_error "Build failed"
        return 1
    fi
}

# Preview production build
preview_production() {
    print_header
    
    if [ ! -d "$PROJECT_DIR/dist" ]; then
        print_error "No production build found"
        print_info "Run '$0 build' first"
        return 1
    fi
    
    print_status "Starting preview server..."
    cd "$PROJECT_DIR"
    npm run preview
}

# Ensure we're in the project directory
cd "$PROJECT_DIR"

# Main script logic
case "$1" in
    start)
        print_header
        kill_vite_server
        start_vite
        if [ $? -eq 0 ]; then
            echo ""
            print_success "🚀 Voxel Engine is ready!"
            echo ""
            echo "  ${GREEN}➤${NC} URL: http://localhost:$VITE_PORT"
            echo "  ${GREEN}➤${NC} Logs: $0 logs"
            echo "  ${GREEN}➤${NC} Stop: $0 stop"
            echo ""
            print_info "Press 'h' in the app for controls"
            
            # Optionally open browser
            if [ "$2" == "--open" ] || [ "$2" == "-o" ]; then
                open_browser
            fi
        fi
        ;;
    
    stop)
        print_header
        kill_vite_server
        ;;
    
    restart)
        print_header
        print_status "Restarting server..."
        $0 stop
        sleep 1
        $0 start "$2"
        ;;
    
    status)
        show_status
        ;;
    
    logs)
        show_logs
        ;;
    
    build)
        build_production
        ;;
    
    preview)
        preview_production
        ;;
    
    clean)
        print_header
        print_status "Cleaning project..."
        rm -rf "$PROJECT_DIR/node_modules" "$PROJECT_DIR/dist" "$PROJECT_DIR/.vite.pid" "$PROJECT_DIR/vite.log"
        print_success "Project cleaned"
        print_info "Run 'npm install' to reinstall dependencies"
        ;;
    
    install)
        print_header
        print_status "Installing dependencies..."
        cd "$PROJECT_DIR"
        npm install
        if [ $? -eq 0 ]; then
            print_success "Dependencies installed successfully"
        else
            print_error "Failed to install dependencies"
        fi
        ;;
    
    *)
        echo ""
        echo -e "${MAGENTA}╔═══════════════════════════════════════════════════╗${NC}"
        echo -e "${MAGENTA}║     NeverEverLand v007 - Voxel Engine Manager    ║${NC}"
        echo -e "${MAGENTA}╚═══════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "${CYAN}Development Commands:${NC}"
        echo "  start [--open]  Start the development server"
        echo "  stop            Stop the development server"
        echo "  restart         Restart the development server"
        echo "  status          Show server status and info"
        echo "  logs            Show server logs (tail -f)"
        echo ""
        echo "${CYAN}Build Commands:${NC}"
        echo "  build           Build for production"
        echo "  preview         Preview production build"
        echo ""
        echo "${CYAN}Maintenance Commands:${NC}"
        echo "  install         Install npm dependencies"
        echo "  clean           Clean build artifacts and logs"
        echo ""
        echo "${GREEN}Examples:${NC}"
        echo "  $0 start           # Start dev server"
        echo "  $0 start --open    # Start and open browser"
        echo "  $0 build           # Create production build"
        echo ""
        exit 1
        ;;
esac