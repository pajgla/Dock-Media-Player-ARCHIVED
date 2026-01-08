/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import GObject from "gi://GObject";
import St from "gi://St";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { MediaWidget } from "./core/classes/MediaWidget.js";
import Clutter from 'gi://Clutter';
import { MediaWatcher } from "./core/classes/MediaWatcher.js";


const DashContainer = GObject.registerClass(
    class DashContainer extends St.BoxLayout {
        _init() {
            super._init({
                style_class: "dash-media-player",
                vertical: true,
                x_expand: true,
                y_expand: true,
            });

            this.mediaPlayerWidget = new MediaWidget();
            this.add_child(this.mediaPlayerWidget);
        }
    }
)

export default class DockMediaPlayerExtension extends Extension 
{
    enable()
    {
        this.dashContainer = new DashContainer();
        this._isVisible = false;
        this._currentStatus = 'expanded';
        this._mediaWatcher = new MediaWatcher((busName, newStatus) => {
            if (newStatus === 'Playing' || newStatus === 'Paused')
            {
                if (this._currentStatus !== 'expanded')
                    this.expandDashMediaContainer();
            }
            else
            {
                if (this._currentStatus !== 'collapsed')
                {
                    this.collapseDashMediaContainer(() => {});
                }
            }

            Main.notify('Media Status Changed', `New status: ${newStatus}`);
        });
        this._mediaWatcher.watchPlayers();
        

        const existingDash = Main.uiGroup.get_children().find(
            actor => actor.get_name() === 'dashtodockContainer' && actor.constructor.name === 'DashToDock'
        );

        if (existingDash)
        {
            this.attachMediaWidget(existingDash);
        }
        else
        {
            let id = Main.uiGroup.connect('child-added', (_, actor) => {
                if ((actor.get_name() === 'dashtodockContainer') && (actor.constructor.name === 'DashToDock'))
                {
                    Main.uiGroup.disconnect(id);
                    this.attachMediaWidget(actor);
                }
            });
        }
    }

    disable()
    {
        this.collapseDashMediaContainer(() => {
                if (this.dashContainer.get_parent()) {
                    this.dashContainer.get_parent().remove_child(this.dashContainer);
                }
                this.dashContainer = null;
        });

        this._mediaWatcher.destroy();
        this._mediaWatcher = null;
    }

    attachMediaWidget(dashToDock)
    {
        this.dashToDockElement = dashToDock;

        const dash = dashToDock.dash;
        dash._box.add_child(this.dashContainer);
        this.collapseDashMediaContainer(() => {});
    }

    expandDashMediaContainer()
    {
        if (this.dashContainer === null) return;

        this._currentStatus = 'expanded';

        // 1. Reset width to -1 so the layout engine can calculate the actual size
        this.dashContainer.set_width(-1);
        
        // 2. Get the width the widget WANTS to be
        const [minWidth, naturalWidth] = this.dashContainer.get_preferred_width(-1);
        
        // If it still returns 0, give it a fallback so it doesn't stay invisible
        const targetWidth = naturalWidth > 0 ? naturalWidth : 200;

        // 3. Set it back to 0 immediately so we can animate from 0
        this.dashContainer.set_width(0);
        this.dashContainer.set_opacity(0);

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.dashContainer.ease({
                width: targetWidth,
                opacity: 255,
                duration: 300,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    // Lock the width after expansion so collapse knows where to start from
                    this.dashContainer.set_width(targetWidth);
                }
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    collapseDashMediaContainer(callback)
    {
        if (this.dashContainer === null)
        {
            console.warn("Dash media container is not initialized.");
            if (callback) callback();
            return;
        }

        this._currentStatus = 'collapsed';

        // Get the current width first
        const currentWidth = this.dashContainer.width;

        // Defer the animation just like expand does
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.dashContainer.ease({
                width: 0,
                opacity: 0,
                duration: 300,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: callback,
            });
            return GLib.SOURCE_REMOVE;
        });
    }
}

