import {remote} from 'electron'
import * as React from 'react'
import * as PropTypes from 'prop-types'
import * as Electron from 'electron'
import * as classnames from 'classnames'

import Portal from '../../../modules/Portal'
import * as s from './ContextMenu.styl'

// const {Menu, MenuItem: ElectronMenuItem} = remote

const buildMenu = (path: EventTarget[], registeredMenus: WeakMap<Element, Electron.MenuItem[]>): Electron.Menu =>
{
    const menus: Electron.MenuItem[] = []

    for (let el of (path as Element[])) {
        const items = registeredMenus.get(el)

        if (items) {
            menus.push(...items)
        }
    }

    const normalizedMenus = menus.filter((item, idx) => {
        if (idx === 0 && item.type === 'separator') {
            // Remove head separator
            return false
        }
        else if (menus[idx - 1] && menus[idx - 1].type === 'separator' && item.type === 'separator') {
            // Remove continuous separator
            return false
        }
        else if (idx === menus.length - 1 && item.type === 'separator') {
            // Remove tail separator
            return false
        }
        else {
            return true
        }
    })

    const menu = new Electron.remote.Menu
    normalizedMenus.forEach(item => menu.append(item))
    return menu
}

const buildMenuElements = ({items}: Electron.Menu): JSX.Element => {
    return (
        <ul className={s.list}>
            {items.map((entry, idx) => {

                switch (entry.type) {
                    case 'separator':
                        return <hr className={classnames(s.item, s[`type--${entry.type}`])} />

                    case 'normal':
                    default:
                        return (
                            <li
                                key={idx}
                                className={classnames(
                                    s.item,
                                    s['type--normal'],
                                    {[s[`hasSubmenu`]]: !!entry.submenu}
                                )}
                                disabled={entry.enabled === false}
                                onClick={() => entry.click(entry, null!, null!)}
                            >
                                {entry.label}
                                {entry.submenu && buildMenuElements(entry.submenu as Electron.Menu)}
                            </li>
                        )
                }
            })}
        </ul>
    )
}

class ContextMenuManager
{
    private activeMenu: Portal|null
    private menus: WeakMap<Element, Electron.MenuItem[]> = new WeakMap()

    private _leakCheck: WeakSet<any>

    constructor()
    {
        __DEV__ && (this._leakCheck = new WeakSet())

        window.addEventListener('contextmenu', e => {
            setTimeout(() => {
                const menus = buildMenu(e.path, this.menus)
                menus.items.length && this.show(menus, e)
            })

            e.preventDefault()
            e.stopPropagation()
        })

        window.addEventListener('click', e => {
            window.requestIdleCallback(() => {
                this.activeMenu && this.activeMenu.unmount()
                this.activeMenu = null

                __DEV__ && console.log(this._leakCheck)
            })
        })
    }

    private onBlur = () => { }

    private show(menus: Electron.Menu, e: PointerEvent)
    {
        if (this.activeMenu) {
            this.activeMenu.unmount()
            this.activeMenu = null
        }

        this.activeMenu = Portal.mount(
            <div
                className={s.root}
                style={{top: e.pageY + 4, left: e.pageX + 4}}
            >
                {buildMenuElements(menus)}
            </div>
        )

        __DEV__ && this._leakCheck!.add(this.activeMenu)
    }

    public register(el: Element, menu: Electron.MenuItem[])
    {
        // const el = ReactDOM.findDOMNode(element)
        this.menus.set(el, menu)
    }

    public unregister(el)
    {
        this.menus.delete(el)
    }
}

const manager = new ContextMenuManager()

interface MenuItemProps {
    label: string
    type?: string
    onClick?: () => any
    checked?: boolean
    submenu?: Electron.MenuItem[]
    context?: any
}

export class MenuItem extends React.Component<MenuItemProps, {}>
{
    protected static propTypes = {
        label: PropTypes.string,
        type: PropTypes.string,
        onClick: PropTypes.func,
        checked: PropTypes.bool,
        submenu: PropTypes.array,
    }

    public render()
    {
        return null
    }
}

export class ContextMenu extends React.Component
{
    public componentDidMount()
    {
        const items = Array.isArray(this.props.children) ? this.props.children : [this.props.children]
        manager.register(this.refs.root.parentElement, items.map(item => this.toMenuItem(item)))
    }

    public componentWillUnMount()
    {
        manager.unregister(this.refs.root)
    }

    public toMenuItem(item: MenuItem)
    {
        return new Electron.remote.MenuItem(this.toMenuItemJSON(item))
    }

    public toMenuItemJSON(item: MenuItem)
    {
        const menuItem: any = {
            label: item.props.label,
            type: item.props.type,
            click: item.props.onClick,
            checked: item.props.checked,
            context: item.props.context,
        }

        const subItems: MenuItem[] = Array.isArray(item.props.children) ? item.props.children : [item.props.children] as any
        if (subItems && subItems.length > 0 && subItems[0] != null) {
            menuItem.submenu = subItems.map(subItem => this.toMenuItemJSON(subItem))
        }

        return menuItem
    }

    public render()
    {
        return <div ref='root' style={{display:'none'}} />
    }
}
