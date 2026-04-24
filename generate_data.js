const fs = require('fs');
const path = require('path');

// Years: 2021-2033
const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

// Geographies with their region grouping
const regions = {
  "North America": ["U.S.", "Canada"],
  "Europe": ["U.K.", "Germany", "Italy", "France", "Spain", "Russia", "Rest of Europe"],
  "Asia Pacific": ["China", "India", "Japan", "South Korea", "ASEAN", "Australia", "Rest of Asia Pacific"],
  "Latin America": ["Brazil", "Argentina", "Mexico", "Rest of Latin America"],
  "Middle East & Africa": ["GCC", "South Africa", "Rest of Middle East & Africa"]
};

/** Flat segment type: segment name -> share of regional total (sums to 1) */
const flatSegmentTypes = {
  "By Mill Type": {
    "Hot Rolling Mills": 0.4,
    "Cold Rolling Mills": 0.35,
    "Strip Mills": 0.25
  },
  "By Material Type": {
    "Carbon Steel Mill Rolls": 0.32,
    "Alloy Steel Mill Rolls": 0.26,
    "Cast Iron Rolls": 0.18,
    "Composite Rolls": 0.14,
    "Others": 0.1
  },
  "By Type of Roll": {
    "High-Speed Steel (HSS) Rolls": 0.45,
    "Cemented Carbide Rolls": 0.32,
    "Sintered Rolls": 0.23
  },
  "By End-Use Industry": {
    "Automotive Industry": 0.28,
    "Construction": 0.18,
    "Shipbuilding": 0.08,
    "Home Appliances": 0.12,
    "Packaging": 0.1,
    "Energy (Power Plants and Renewable Energy)": 0.14,
    "Other Industrial Applications": 0.1
  },
  "By Distribution Type": {
    "Direct Sales": 0.58,
    "Indirect (via Distributors)": 0.42
  }
};

/** Hierarchical: parent -> { share of regional total, children: leaf -> share within parent } */
const productTypeHierarchy = {
  "Hot-Rolled Steel": {
    share: 0.36,
    children: { "Work Rolls": 0.55, "Backup Rolls": 0.45 }
  },
  "Cold-Rolled Steel": {
    share: 0.34,
    children: { "Work Rolls": 0.55, "Backup Rolls": 0.45 }
  },
  "Plates & Coils": {
    share: 0.3,
    children: {
      "Mill Rolls for Plate Production": 0.52,
      "Coil Rolls": 0.48
    }
  }
};

// Regional base values (USD Million) for 2021 - total market per region (mill roll equipment / rolls)
const regionBaseValues = {
  "North America": 1850,
  "Europe": 1420,
  "Asia Pacific": 1980,
  "Latin America": 480,
  "Middle East & Africa": 360
};

const countryShares = {
  "North America": { "U.S.": 0.82, "Canada": 0.18 },
  "Europe": { "U.K.": 0.18, "Germany": 0.22, "Italy": 0.12, "France": 0.16, "Spain": 0.1, "Russia": 0.08, "Rest of Europe": 0.14 },
  "Asia Pacific": { "China": 0.28, "India": 0.12, "Japan": 0.25, "South Korea": 0.12, "ASEAN": 0.1, "Australia": 0.07, "Rest of Asia Pacific": 0.06 },
  "Latin America": { "Brazil": 0.45, "Argentina": 0.15, "Mexico": 0.25, "Rest of Latin America": 0.15 },
  "Middle East & Africa": { "GCC": 0.45, "South Africa": 0.25, "Rest of Middle East & Africa": 0.3 }
};

const regionGrowthRates = {
  "North America": 0.052,
  "Europe": 0.048,
  "Asia Pacific": 0.068,
  "Latin America": 0.055,
  "Middle East & Africa": 0.051
};

const segmentGrowthMultipliersFlat = {
  "By Mill Type": {
    "Hot Rolling Mills": 1.0,
    "Cold Rolling Mills": 1.04,
    "Strip Mills": 0.98
  },
  "By Material Type": {
    "Carbon Steel Mill Rolls": 0.97,
    "Alloy Steel Mill Rolls": 1.05,
    "Cast Iron Rolls": 0.95,
    "Composite Rolls": 1.12,
    "Others": 1.0
  },
  "By Type of Roll": {
    "High-Speed Steel (HSS) Rolls": 1.06,
    "Cemented Carbide Rolls": 1.1,
    "Sintered Rolls": 0.99
  },
  "By End-Use Industry": {
    "Automotive Industry": 1.05,
    "Construction": 1.0,
    "Shipbuilding": 0.98,
    "Home Appliances": 1.04,
    "Packaging": 1.02,
    "Energy (Power Plants and Renewable Energy)": 1.08,
    "Other Industrial Applications": 1.0
  },
  "By Distribution Type": {
    "Direct Sales": 1.02,
    "Indirect (via Distributors)": 0.99
  }
};

const segmentGrowthMultipliersProduct = {
  "Hot-Rolled Steel": { "Work Rolls": 1.0, "Backup Rolls": 0.99 },
  "Cold-Rolled Steel": { "Work Rolls": 1.04, "Backup Rolls": 1.02 },
  "Plates & Coils": { "Mill Rolls for Plate Production": 1.0, "Coil Rolls": 1.03 }
};

const volumePerMillionUSD = 0.45;

let seed = 42;
function seededRandom() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

function addNoise(value, noiseLevel = 0.03) {
  return value * (1 + (seededRandom() - 0.5) * 2 * noiseLevel);
}

function roundTo1(val) {
  return Math.round(val * 10) / 10;
}

function roundToInt(val) {
  return Math.round(val);
}

function generateTimeSeries(baseValue, growthRate, roundFn) {
  const series = {};
  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const rawValue = baseValue * Math.pow(1 + growthRate, i);
    series[year] = roundFn(addNoise(rawValue));
  }
  return series;
}

function fillFlatSegmentType(target, segType, regionBase, regionGrowth, isVolume, countryGrowthOverride) {
  const roundFn = isVolume ? roundToInt : roundTo1;
  const segments = flatSegmentTypes[segType];
  const mults = segmentGrowthMultipliersFlat[segType];
  const growth = countryGrowthOverride ?? regionGrowth;
  target[segType] = {};
  for (const [segName, share] of Object.entries(segments)) {
    const segGrowth = growth * (mults[segName] ?? 1);
    const segBase = regionBase * share;
    target[segType][segName] = generateTimeSeries(segBase, segGrowth, roundFn);
  }
}

function fillProductTypeHierarchy(target, regionBase, regionGrowth, isVolume, countryGrowthOverride) {
  const roundFn = isVolume ? roundToInt : roundTo1;
  const growth = countryGrowthOverride ?? regionGrowth;
  target["By Product Type"] = {};
  for (const [parentName, { share, children }] of Object.entries(productTypeHierarchy)) {
    target["By Product Type"][parentName] = {};
    for (const [childName, cShare] of Object.entries(children)) {
      const mult = (segmentGrowthMultipliersProduct[parentName] && segmentGrowthMultipliersProduct[parentName][childName]) || 1;
      const segGrowth = growth * mult;
      const segBase = regionBase * share * cShare;
      const shareVariation = 1 + (seededRandom() - 0.5) * 0.08;
      target["By Product Type"][parentName][childName] = generateTimeSeries(
        segBase * shareVariation,
        segGrowth,
        roundFn
      );
    }
  }
}

function generateData(isVolume) {
  const data = {};
  const roundFn = isVolume ? roundToInt : roundTo1;
  const multiplier = isVolume ? volumePerMillionUSD : 1;

  for (const [regionName, countries] of Object.entries(regions)) {
    const regionBase = regionBaseValues[regionName] * multiplier;
    const regionGrowth = regionGrowthRates[regionName];

    data[regionName] = {};

    fillProductTypeHierarchy(data[regionName], regionBase, regionGrowth, isVolume, null);
    for (const segType of Object.keys(flatSegmentTypes)) {
      fillFlatSegmentType(data[regionName], segType, regionBase, regionGrowth, isVolume, null);
    }

    data[regionName]["By Country"] = {};
    for (const country of countries) {
      const cShare = countryShares[regionName][country];
      const countryGrowthVariation = 1 + (seededRandom() - 0.5) * 0.06;
      const countryBase = regionBase * cShare;
      const countryGrowth = regionGrowth * countryGrowthVariation;
      data[regionName]["By Country"][country] = generateTimeSeries(countryBase, countryGrowth, roundFn);
    }

    for (const country of countries) {
      const cShare = countryShares[regionName][country];
      const countryBase = regionBase * cShare;
      const countryGrowthVariation = 1 + (seededRandom() - 0.5) * 0.04;
      const countryGrowth = regionGrowth * countryGrowthVariation;

      data[country] = {};
      fillProductTypeHierarchy(data[country], countryBase, countryGrowth, isVolume, countryGrowth);
      for (const segType of Object.keys(flatSegmentTypes)) {
        const segTypeObj = {};
        for (const [segName, share] of Object.entries(flatSegmentTypes[segType])) {
          const mults = segmentGrowthMultipliersFlat[segType];
          const segGrowth = countryGrowth * (mults[segName] ?? 1);
          const shareVariation = 1 + (seededRandom() - 0.5) * 0.1;
          const segBase = countryBase * share * shareVariation;
          segTypeObj[segName] = generateTimeSeries(segBase, segGrowth, isVolume ? roundToInt : roundTo1);
        }
        data[country][segType] = segTypeObj;
      }
    }
  }

  return data;
}

seed = 42;
const valueData = generateData(false);
seed = 7777;
const volumeData = generateData(true);

const outDir = path.join(__dirname, 'public', 'data');
fs.writeFileSync(path.join(outDir, 'value.json'), JSON.stringify(valueData, null, 2));
fs.writeFileSync(path.join(outDir, 'volume.json'), JSON.stringify(volumeData, null, 2));

console.log('Generated value.json and volume.json (mill roll segments)');
console.log('Segment types on North America:', Object.keys(valueData['North America']));
