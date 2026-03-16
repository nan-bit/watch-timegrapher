// Movement / caliber database
// Fields: brand, caliber, bph (beats per hour), liftAngle (degrees)
export const COMMON_MOVEMENTS = [
    // ── Seiko ──────────────────────────────────────────────────────────────
    { brand: "Seiko", caliber: "7S26",  bph: 21600, liftAngle: 52 },
    { brand: "Seiko", caliber: "7S36",  bph: 21600, liftAngle: 52 },
    { brand: "Seiko", caliber: "4R34",  bph: 21600, liftAngle: 53 },
    { brand: "Seiko", caliber: "4R35",  bph: 21600, liftAngle: 53 },
    { brand: "Seiko", caliber: "4R36",  bph: 21600, liftAngle: 53 },
    { brand: "Seiko", caliber: "4R37",  bph: 21600, liftAngle: 53 },
    { brand: "Seiko", caliber: "4R38",  bph: 21600, liftAngle: 53 },
    { brand: "Seiko", caliber: "NH35",  bph: 21600, liftAngle: 53 },
    { brand: "Seiko", caliber: "NH36",  bph: 21600, liftAngle: 53 },
    { brand: "Seiko", caliber: "NH38",  bph: 21600, liftAngle: 53 },
    { brand: "Seiko", caliber: "6R15",  bph: 28800, liftAngle: 52 },
    { brand: "Seiko", caliber: "6R35",  bph: 28800, liftAngle: 52 },
    { brand: "Seiko", caliber: "6R54",  bph: 28800, liftAngle: 52 },
    { brand: "Seiko", caliber: "6R55",  bph: 28800, liftAngle: 52 },
    { brand: "Seiko", caliber: "8L35",  bph: 28800, liftAngle: 52 },
    { brand: "Seiko", caliber: "9SA5",  bph: 36000, liftAngle: 54 },

    // ── ETA ────────────────────────────────────────────────────────────────
    { brand: "ETA", caliber: "2824-2",       bph: 28800, liftAngle: 50 },
    { brand: "ETA", caliber: "2836-2",       bph: 28800, liftAngle: 50 },
    { brand: "ETA", caliber: "2892-A2",      bph: 28800, liftAngle: 51 },
    { brand: "ETA", caliber: "2893-2",       bph: 28800, liftAngle: 51 },
    { brand: "ETA", caliber: "2801-2",       bph: 28800, liftAngle: 50 },
    { brand: "ETA", caliber: "6497-1",       bph: 18000, liftAngle: 44 },
    { brand: "ETA", caliber: "6498-1",       bph: 18000, liftAngle: 44 },
    { brand: "ETA", caliber: "7750 (Valjoux)", bph: 28800, liftAngle: 50 },
    { brand: "ETA", caliber: "Powermatic 80", bph: 21600, liftAngle: 50 },

    // ── Sellita ────────────────────────────────────────────────────────────
    { brand: "Sellita", caliber: "SW200-1",  bph: 28800, liftAngle: 50 },
    { brand: "Sellita", caliber: "SW300-1",  bph: 28800, liftAngle: 51 },
    { brand: "Sellita", caliber: "SW500",    bph: 28800, liftAngle: 50 },

    // ── Rolex ──────────────────────────────────────────────────────────────
    { brand: "Rolex", caliber: "3130",  bph: 28800, liftAngle: 52 },
    { brand: "Rolex", caliber: "3135",  bph: 28800, liftAngle: 52 },
    { brand: "Rolex", caliber: "3185",  bph: 28800, liftAngle: 52 },
    { brand: "Rolex", caliber: "3235",  bph: 28800, liftAngle: 53 },
    { brand: "Rolex", caliber: "4130",  bph: 28800, liftAngle: 52 },
    { brand: "Rolex", caliber: "7750",  bph: 28800, liftAngle: 50 },

    // ── Miyota ─────────────────────────────────────────────────────────────
    { brand: "Miyota", caliber: "6T33",  bph: 21600, liftAngle: 49 },
    { brand: "Miyota", caliber: "8215",  bph: 21600, liftAngle: 49 },
    { brand: "Miyota", caliber: "8217",  bph: 21600, liftAngle: 49 },
    { brand: "Miyota", caliber: "8N24",  bph: 21600, liftAngle: 49 },
    { brand: "Miyota", caliber: "9015",  bph: 28800, liftAngle: 51 },
    { brand: "Miyota", caliber: "9039",  bph: 28800, liftAngle: 51 },
    { brand: "Miyota", caliber: "9132",  bph: 28800, liftAngle: 51 },

    // ── Citizen ────────────────────────────────────────────────────────────
    { brand: "Citizen", caliber: "0100",  bph: 28800, liftAngle: 52 },
    { brand: "Citizen", caliber: "8200",  bph: 28800, liftAngle: 52 },

    // ── Vostok ─────────────────────────────────────────────────────────────
    { brand: "Vostok", caliber: "2409",  bph: 18000, liftAngle: 52 },
    { brand: "Vostok", caliber: "2415",  bph: 18000, liftAngle: 52 },

    // ── Unitas ─────────────────────────────────────────────────────────────
    { brand: "Unitas", caliber: "6497",  bph: 18000, liftAngle: 44 },
    { brand: "Unitas", caliber: "6498",  bph: 18000, liftAngle: 44 },

    // ── Generic ────────────────────────────────────────────────────────────
    { brand: "Generic", caliber: "Standard (28800 BPH)", bph: 28800, liftAngle: 52 },
    { brand: "Generic", caliber: "Standard (21600 BPH)", bph: 21600, liftAngle: 52 },
    { brand: "Generic", caliber: "Standard (18000 BPH)", bph: 18000, liftAngle: 52 },
];
