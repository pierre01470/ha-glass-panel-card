# Glass Panel Card

Carte Lovelace autonome pour Home Assistant : glassmorphism, layout CSS Grid maison, responsive reel via container queries. Aucune dependance.

## Installation

HACS > Frontend > depot custom : `pierre01470/ha-glass-panel-card` (categorie *Lovelace*).

## Exemple

```yaml
type: custom:glass-panel-card
clock: true
pills:
  - entity: sensor.clim_etat
    icon: mdi:air-conditioner
tiles:
  - type: hero
    entity: sensor.temperature_salon
    name: Salon
    icon: mdi:thermometer
    span: 2
  - type: light
    entity: light.salon
    name: Lumieres
    icon: mdi:chandelier
    color: "#f0a020"
dock:
  - entity: sensor.puissance
    icon: mdi:flash
```

## Types de tuiles

`hero`, `sensor`, `light`, `climate`, `media`, `select`, `toggle`, `cover`, `script`

## Options

| Option | Type | Description |
|---|---|---|
| `background` | string | CSS background du panneau |
| `clock` | bool | Affiche l'horloge |
| `pills` | list | Pastilles d'etat en haut |
| `tiles` | list | Tuiles de la grille |
| `dock` | list | Barre du bas |

Par tuile : `type`, `entity`, `name`, `icon`, `color`, `span` (1-4), `decimals`, `state_entity`, `buttons`.
