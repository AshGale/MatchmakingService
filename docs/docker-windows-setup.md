# Docker Setup Guide for Windows 10

## Prerequisites
- Windows 10 64-bit: Pro, Enterprise, or Education (Build 16299 or later)
- Windows 10 Home (Build 19041 or later)
- 4GB system RAM minimum
- BIOS-level hardware virtualization support must be enabled

## Installation Steps

1. **Download Docker Desktop**
   - Go to [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
   - Click "Download for Windows"

2. **Install Docker Desktop**
   - Double-click the installer
   - Follow the installation wizard
   - When prompted, ensure the "Use WSL 2 instead of Hyper-V" option is selected (recommended)
   - Click "Ok" to install required Windows components

3. **Enable WSL 2 (if prompted)**
   - Open PowerShell as Administrator and run:
   ```powershell
   dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
   dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
   ```
   - Restart your computer
   - Download and install the WSL 2 Linux kernel update package from [Microsoft](https://aka.ms/wsl2kernel)
   - Set WSL 2 as default:
   ```powershell
   wsl --set-default-version 2
   ```

4. **Start Docker Desktop**
   - Launch Docker Desktop from the Start menu
   - Wait for Docker to start (the whale icon in the taskbar will stop animating)
   - You may be prompted to log in or create a Docker Hub account (optional)

5. **Verify Installation**
   - Open PowerShell or Command Prompt
   - Run: `docker --version`
   - Run: `docker-compose --version`
   - Run: `docker run hello-world`

6. **Add User to docker-users Group**
   - Open Computer Management (right-click Start menu > Computer Management)
   - Navigate to System Tools > Local Users and Groups > Groups
   - Double-click the "docker-users" group
   - Click "Add..." and add your Windows user account
   - Log out and log back in for changes to take effect

## Troubleshooting

- If you encounter errors about Hyper-V or WSL, ensure virtualization is enabled in your BIOS
- For WSL errors, run `wsl --update` to ensure WSL is fully updated
- If Docker fails to start, try resetting to factory defaults in Docker Desktop settings

## Additional Windows-Specific Configuration

### File Sharing
1. Right-click the Docker icon in system tray
2. Select "Settings"
3. Navigate to "Resources" > "File Sharing"
4. Add the path to your project: `c:\Users\ashga\Documents\Code\MatchmakingService`
5. Click "Apply & Restart"

### Resources
Adjust memory, CPU, and disk space allocated to Docker:
1. Right-click the Docker icon in system tray
2. Select "Settings"
3. Navigate to "Resources"
4. Allocate at least 4GB of RAM and 2 CPUs for optimal performance
5. Click "Apply & Restart"
