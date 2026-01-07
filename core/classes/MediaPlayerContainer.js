import Gio from "gi://Gio";
import Shell from "gi://Shell";
import St from "gi://St";
import GdkPixbuf from "gi://GdkPixbuf";
import { MediaPlayer } from "./MediaPlayer";

const dBusInterface = `
<node>
	<interface name="org.freedesktop.DBus">
		<method name="ListNames">
			<arg direction="out" type="as"/>
		</method>
		<signal name="NameOwnerChanged">
			<arg direction="out" type="s"/>
			<arg direction="out" type="s"/>
			<arg direction="out" type="s"/>
		</signal>
	</interface>
</node>`;

export var MediaPlayerContainer = class MediaPlayerContainer {
    constructor()
    {
        this.allPlayers = [];
        this.selectedPlayer = null;

        const dBusProxyWrapper = Gio.DBusProxy.makeProxyWrapper(dBusInterface);
        this.dBusProxy = dBusProxyWrapper(
            Gio.DBus.session,
            "org.freedesktop.DBus",
            "/org/freedesktop/DBus",
            this._init.bind(this)
        );
        
    }

    pick() {
        let newestTimestamp = 0;
        let bestChoice = null;

        this.allPlayers.forEach((player) => {
            if (player.statusTimestamp > newestTimestamp) {
                newestTimestamp = player.statusTimestamp;
                bestChoice = player;
            }
        });

        this.selected = bestChoice;
        return this.selected;
    }

    _initList() {
        let dBusList = this.dBusProxy.ListNamesSync()[0];
        dBusList = dBusList.filter((element) =>
            element.startsWith("org.mpris.MediaPlayer2")
        );
        this.unfilteredList = [];
        dBusList.forEach((address) =>
            this.unfilteredList.push(new MediaPlayer(address))
        );

        this.dBusProxy.connectSignal(
            "NameOwnerChanged",
            this._updateList.bind(this)
        );
    }

    next()
    {
        const allPlayersLength = this.allPlayers.length;
        if (allPlayersLength == 0)
        {
            this.selectedPlayer = null;
            return this.selectedPlayer;
        }

        let currentIndex = this.allPlayers.indexOf(this.selectedPlayer);
        if (currentIndex == -1)
        {
            this.selectedPlayer = this.allPlayers[0];
        }
        else
        {
            currentIndex = this.wrapIndex(currentIndex + 1, allPlayersLength);
            this.selectedPlayer = this.allPlayers[currentIndex];
        }

        return this.selectedPlayer;
    }

    wrapIndex(index, length)
    {
        return ((index % length) + length) % length;
    }

    _updateList(proxy, sender, [name, oldOwner, newOwner]) {
        if (name.startsWith("org.mpris.MediaPlayer2")) {
        if (newOwner && !oldOwner) {
            //add player
            let player = new Player(name);
            this.allPlayers.push(player);
        } else if (!newOwner && oldOwner) {
            //delete player
            this.allPlayers = this.allPlayers.filter(
                (player) => player.address != name
            );
        }
        }
    }
}