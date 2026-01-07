import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// MPRIS D-Bus interface
const MPRIS_PLAYER_PREFIX = 'org.mpris.MediaPlayer2';
const MPRIS_PLAYER_INTERFACE = 'org.mpris.MediaPlayer2.Player';
const MPRIS_PATH = '/org/mpris/MediaPlayer2';

export const MediaMonitor = class MediaMonitor {
    constructor() {
        this._players = new Map();
        this._dbusProxy = null;
        this._signalIds = [];
    }

    enable() {
        console.log('------------------------------------------------------------------------------------------------------------------------------- MediaMonitor: Starting initialization...');
        
        // Monitor D-Bus for media players
        try {
            // Create the DBus proxy asynchronously
            Gio.DBusProxy.new(
                Gio.DBus.session,
                Gio.DBusProxyFlags.NONE,
                null,
                'org.freedesktop.DBus',
                '/org/freedesktop/DBus',
                'org.freedesktop.DBus',
                null,
                (source, result) => {
                    try {
                        this._dbusProxy = Gio.DBusProxy.new_finish(result);
                        console.log('-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: DBus proxy initialized');

                        // Listen for new media players appearing
                        let nameOwnerId = this._dbusProxy.connectSignal(
                            'NameOwnerChanged',
                            this._onNameOwnerChanged.bind(this)
                        );
                        this._signalIds.push({ proxy: this._dbusProxy, id: nameOwnerId });
                        console.log('-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: NameOwnerChanged signal connected');

                        // Scan for existing media players
                        this._scanForPlayers();
                    } catch (e) {
                        console.error('-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Failed to finish proxy initialization:', e);
                        Main.notify('-------------------------------------------------------------------------------------------------------------------------------Media Controls Error', `Proxy init failed: ${e.message}`);
                    }
                }
            );
        } catch (e) {
            console.error('-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Failed to initialize:', e);
            Main.notify('-------------------------------------------------------------------------------------------------------------------------------Media Controls Error', `Initialization failed: ${e.message}`);
        }
    }

    disable() {
        console.log('-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Disabling...');
        
        // Disconnect all signals
        this._signalIds.forEach(({ proxy, id }) => {
            try {
                proxy.disconnectSignal(id);
            } catch (e) {
                console.error('-------------------------------------------------------------------------------------------------------------------------------Failed to disconnect signal:', e);
            }
        });
        this._signalIds = [];

        // Clean up players
        this._players.forEach((player, busName) => this._removePlayer(busName));
        this._players.clear();
        
        this._dbusProxy = null;
        
        console.log('-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Disabled');
    }

    _scanForPlayers() {
        console.log('-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Scanning for existing players...');
        
        this._dbusProxy.call(
            'ListNames',
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (proxy, result) => {
                try {
                    let [names] = proxy.call_finish(result).deep_unpack();
                    console.log(`-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Found ${names.length} total D-Bus names`);
                    
                    let mprisPlayers = names.filter(name => name.startsWith(MPRIS_PLAYER_PREFIX));
                    console.log(`-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Found ${mprisPlayers.length} MPRIS players:`, mprisPlayers);
                    
                    if (mprisPlayers.length > 0) {
                        Main.notify('-------------------------------------------------------------------------------------------------------------------------------Media Controls', `Found ${mprisPlayers.length} media player(s)`);
                    }
                    
                    mprisPlayers.forEach(name => {
                        this._addPlayer(name);
                    });
                } catch (e) {
                    console.error('-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Failed to scan for media players:', e);
                    logError(e, '-------------------------------------------------------------------------------------------------------------------------------Failed to scan for media players');
                }
            }
        );
    }

    _onNameOwnerChanged(proxy, sender, [name, oldOwner, newOwner]) {
        console.log(`-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: NameOwnerChanged - ${name}, old: ${oldOwner}, new: ${newOwner}`);
        
        if (!name.startsWith(MPRIS_PLAYER_PREFIX))
            return;

        console.log(`-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: MPRIS player change detected: ${name}`);
        
        if (newOwner && !oldOwner) {
            // New player appeared
            console.log(`-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: New player appearing: ${name}`);
            Main.notify('-------------------------------------------------------------------------------------------------------------------------------Media Controls', `New player: ${name}`);
            this._addPlayer(name);
        } else if (!newOwner && oldOwner) {
            // Player disappeared
            console.log(`-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Player disappearing: ${name}`);
            this._removePlayer(name);
        }
    }

    _addPlayer(busName) {
        if (this._players.has(busName)) {
            console.log(`-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Player ${busName} already exists, skipping`);
            return;
        }

        console.log(`-------------------------------------------------------------------------------------------------------------------------------ediaMonitor: Adding media player: ${busName}`);
        Main.notify('-------------------------------------------------------------------------------------------------------------------------------Media Controls', `Adding player: ${busName.split('.').pop()}`);

        try {
            // Create proxy for the player
            let playerProxy = new Gio.DBusProxy({
                g_connection: Gio.DBus.session,
                g_interface_name: MPRIS_PLAYER_INTERFACE,
                g_name: busName,
                g_object_path: MPRIS_PATH,
            });

            playerProxy.init(null);
            console.log(`-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Proxy created for ${busName}`);

            // Listen for property changes (playback status, metadata, etc.)
            let propId = playerProxy.connect('g-properties-changed', 
                this._onPlayerPropertiesChanged.bind(this, busName)
            );

            this._players.set(busName, {
                proxy: playerProxy,
                signalId: propId
            });

            console.log(`-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Player ${busName} successfully added`);

            // Get initial state
            this._updatePlayerState(busName, playerProxy);
        } catch (e) {
            console.error(`-------------------------------------------------------------------------------------------------------------------------------MediaMonitor: Failed to add player ${busName}:`, e);
            Main.notify('-------------------------------------------------------------------------------------------------------------------------------Media Controls Error', `Failed to add player: ${e.message}`);
        }
    }

    _removePlayer(busName) {
        let player = this._players.get(busName);
        if (!player)
            return;

        console.log(`-------------------------------------------------------------------------------------------------------------------------------Removing media player: ${busName}`);
        
        if (player.signalId)
            player.proxy.disconnect(player.signalId);
        
        this._players.delete(busName);
    }

    _onPlayerPropertiesChanged(busName, proxy, changed, invalidated) {
        // Properties changed - update the state
        this._updatePlayerState(busName, proxy);
    }

    _updatePlayerState(busName, proxy) {
        try {
            let playbackStatus = proxy.PlaybackStatus;
            let metadata = proxy.Metadata;

            if (!metadata)
                return;

            // Check if media is actually playing
            let isPlaying = playbackStatus === 'Playing';

            // Extract metadata
            let trackData = this._extractMetadata(metadata);
            
            console.log(`-------------------------------------------------------------------------------------------------------------------------------Player: ${busName}`);
            console.log(`-------------------------------------------------------------------------------------------------------------------------------Status: ${playbackStatus}`);
            console.log(`-------------------------------------------------------------------------------------------------------------------------------Track: ${trackData.title} by ${trackData.artist}`);
            console.log(`-------------------------------------------------------------------------------------------------------------------------------Album: ${trackData.album}`);
            console.log(`-------------------------------------------------------------------------------------------------------------------------------Cover: ${trackData.artUrl}`);

            // TODO: Update your UI here with this data
            this._updateUI(busName, isPlaying, trackData);

        } catch (e) {
            logError(e, `-------------------------------------------------------------------------------------------------------------------------------Failed to update player state for ${busName}`);
        }
    }

    _extractMetadata(metadata) {
        // MPRIS metadata is a GVariant dictionary
        let title = metadata['xesam:title']?.unpack() || 'Unknown Title';
        let artist = metadata['xesam:artist']?.deep_unpack()?.[0] || 'Unknown Artist';
        let album = metadata['xesam:album']?.unpack() || 'Unknown Album';
        let artUrl = metadata['mpris:artUrl']?.unpack() || '';
        let trackId = metadata['mpris:trackid']?.unpack() || '';

        return {
            title,
            artist,
            album,
            artUrl,
            trackId
        };
    }

    _updateUI(busName, isPlaying, trackData) {
        // This is where you'll update your dash element
        // We'll implement this in the next step
        
        // Send desktop notification for testing
        Main.notify(
            'Media Update',
            `${isPlaying ? '▶️ Playing' : '⏸️ Paused'}: ${trackData.title}\nBy: ${trackData.artist}\nAlbum: ${trackData.album}`
        );
    }

    // Get currently active player (usually the one that's playing)
    getActivePlayer() {
        for (let [busName, player] of this._players) {
            if (player.proxy.PlaybackStatus === 'Playing') {
                return {
                    busName,
                    proxy: player.proxy,
                    metadata: this._extractMetadata(player.proxy.Metadata || {})
                };
            }
        }
        return null;
    }

    // Get all players
    getAllPlayers() {
        let players = [];
        for (let [busName, player] of this._players) {
            players.push({
                busName,
                playbackStatus: player.proxy.PlaybackStatus,
                metadata: this._extractMetadata(player.proxy.Metadata || {})
            });
        }
        return players;
    }
}