#!/bin/bash

APP_DIR="/migra"
SERVICE_FILE="/etc/systemd/system/migra.service"
USER="root" # Standard user or current user

# Check for root privilege
if [[ $EUID -ne 0 ]]; then
   echo "Questo script deve essere eseguito come root o con sudo." 
   exit 1
fi

case "$1" in
    install)
        echo "Installazione del servizio migra.service..."
        cat <<EOF > $SERVICE_FILE
[Unit]
Description=Proxmox LXC Migration Tool (Backend + Frontend)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=/bin/bash $APP_DIR/migra-worker.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        chmod +x $APP_DIR/migra-worker.sh
        systemctl daemon-reload
        echo "Servizio installato. Ora puoi fare 'enable' o 'start'."
        ;;

    enable)
        systemctl enable migra
        echo "Autostart abilitato."
        ;;

    disable)
        systemctl disable migra
        echo "Autostart disabilitato."
        ;;

    start)
        systemctl start migra
        echo "Servizio avviato."
        ;;

    stop)
        systemctl stop migra
        echo "Servizio fermato."
        ;;

    restart)
        systemctl restart migra
        echo "Servizio riavviato."
        ;;

    status)
        systemctl status migra
        ;;

    *)
        echo "Utilizzo: $0 {install|enable|disable|start|stop|restart|status}"
        exit 1
        ;;
esac

exit 0
