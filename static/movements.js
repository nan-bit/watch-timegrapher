export const COMMON_MOVEMENTS = [
    // Seiko
    { brand: "Seiko", caliber: "7S26", liftAngle: 52 },
    { brand: "Seiko", caliber: "7S36", liftAngle: 52 },
    { brand: "Seiko", caliber: "4R35", liftAngle: 53 },
    { brand: "Seiko", caliber: "4R36", liftAngle: 53 },
    { brand: "Seiko", caliber: "NH35", liftAngle: 53 },
    { brand: "Seiko", caliber: "NH36", liftAngle: 53 },
    { brand: "Seiko", caliber: "6R15", liftAngle: 52 },
    { brand: "Seiko", caliber: "6R35", liftAngle: 52 },
    
    // ETA
    { brand: "ETA", caliber: "2824-2", liftAngle: 50 },
    { brand: "ETA", caliber: "2892-A2", liftAngle: 51 },
    { brand: "ETA", caliber: "2801-2", liftAngle: 50 },
    { brand: "ETA", caliber: "6497-1", liftAngle: 44 },
    { brand: "ETA", caliber: "6498-1", liftAngle: 44 },
    { brand: "ETA", caliber: "7750 (Valjoux)", liftAngle: 50 },
    { brand: "ETA", caliber: "Powermatic 80", liftAngle: 50 }, // Often based on 2824 arch, sometimes 53 depending on version, generic C07.111 is often cited as 50-52. Sticking to safe defaults.

    // Rolex
    { brand: "Rolex", caliber: "3130", liftAngle: 52 },
    { brand: "Rolex", caliber: "3135", liftAngle: 52 },
    { brand: "Rolex", caliber: "3185", liftAngle: 52 },
    { brand: "Rolex", caliber: "3235", liftAngle: 53 }, // Controversial, 53-55 often cited.
    { brand: "Rolex", caliber: "4130", liftAngle: 52 },

    // Miyota
    { brand: "Miyota", caliber: "8215", liftAngle: 49 },
    { brand: "Miyota", caliber: "9015", liftAngle: 51 },

    // Generic
    { brand: "Generic", caliber: "Standard", liftAngle: 52 }
];
