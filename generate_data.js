const fs = require('fs');
const path = require('path');

// Years: 2021-2033
const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

const regions = {
  "North America": ["U.S.", "Canada"],
  "Europe": ["U.K.", "Germany", "Italy", "France", "Spain", "Russia", "Rest of Europe"],
  "Asia Pacific": ["China", "India", "Japan", "South Korea", "ASEAN", "Australia", "Rest of Asia Pacific"],
  "Latin America": ["Brazil", "Argentina", "Mexico", "Rest of Latin America"],
  "Middle East & Africa": ["GCC", "South Africa", "Rest of Middle East & Africa"]
};

/** All segment types are flat (shares sum to 1.0 per type) */
const flatSegmentTypes = {
  "By Roll Type / Mill Position": {
    "Work Rolls": 0.16,
    "Backup Rolls": 0.15,
    "Intermediate Rolls": 0.12,
    "Edger / Vertical Rolls": 0.08,
    "Pinch Rolls": 0.08,
    "Leveller Rolls": 0.1,
    "Skin-Pass Rolls": 0.12,
    "Others": 0.19
  },
  "By Rolling Mill Line": {
    "Hot Strip Mills": 0.15,
    "Cold Rolling Mills": 0.14,
    "Plate Mills": 0.12,
    "Steckel Mills": 0.08,
    "Bar Mills": 0.1,
    "Wire Rod Mills": 0.1,
    "Rail & Section Mills": 0.1,
    "Rebar Mills": 0.1,
    "Pipe & Tube Mills": 0.11
  },
  "By Roll Size / Diameter Range": {
    "Below 300 mm": 0.24,
    "300–600 mm": 0.28,
    "600–1,000 mm": 0.2,
    "1,000–1,500 mm": 0.16,
    "Above 1,500 mm": 0.12
  },
  "By End-Use Industries": {
    "Automotive Industry": 0.12,
    "Construction & Infrastructure": 0.14,
    "Oil & Gas Industry": 0.08,
    "Shipbuilding": 0.05,
    "Energy & Power Generation": 0.1,
    "Aerospace & Defense": 0.08,
    "Heavy Machinery & Equipment": 0.1,
    "Consumer Goods": 0.07,
    "Steel Service Centers & Processing": 0.1,
    "Electronics Industry": 0.08,
    "Others, (Packaging Industry, etc.)": 0.08
  },
  "By Distribution Type": {
    "Direct Sales": 0.32,
    "Indirect (via Distributors)": 0.28,
    "Steel Service Centers & Processing": 0.16,
    "Electronics Industry": 0.12,
    "Others, (Packaging Industry, etc.)": 0.12
  }
};

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

/** Relative growth multipliers (× regional CAGR) per leaf segment */
const segmentGrowthMultipliersFlat = (() => {
  const m = {
    "By Roll Type / Mill Position": {
      "Work Rolls": 1.02,
      "Backup Rolls": 0.99,
      "Intermediate Rolls": 1.0,
      "Edger / Vertical Rolls": 1.01,
      "Pinch Rolls": 0.98,
      "Leveller Rolls": 1.03,
      "Skin-Pass Rolls": 1.04,
      "Others": 0.97
    },
    "By Rolling Mill Line": {
      "Hot Strip Mills": 1.02,
      "Cold Rolling Mills": 1.04,
      "Plate Mills": 1.0,
      "Steckel Mills": 0.99,
      "Bar Mills": 1.01,
      "Wire Rod Mills": 1.02,
      "Rail & Section Mills": 0.98,
      "Rebar Mills": 1.03,
      "Pipe & Tube Mills": 1.01
    },
    "By Roll Size / Diameter Range": {
      "Below 300 mm": 1.0,
      "300–600 mm": 1.02,
      "600–1,000 mm": 1.01,
      "1,000–1,500 mm": 0.99,
      "Above 1,500 mm": 0.98
    },
    "By End-Use Industries": {
      "Automotive Industry": 1.05,
      "Construction & Infrastructure": 1.0,
      "Oil & Gas Industry": 0.99,
      "Shipbuilding": 0.98,
      "Energy & Power Generation": 1.06,
      "Aerospace & Defense": 1.04,
      "Heavy Machinery & Equipment": 1.02,
      "Consumer Goods": 1.01,
      "Steel Service Centers & Processing": 1.0,
      "Electronics Industry": 1.08,
      "Others, (Packaging Industry, etc.)": 0.99
    },
    "By Distribution Type": {
      "Direct Sales": 1.02,
      "Indirect (via Distributors)": 0.99,
      "Steel Service Centers & Processing": 1.0,
      "Electronics Industry": 1.05,
      "Others, (Packaging Industry, etc.)": 0.98
    }
  };
  for (const segType of Object.keys(flatSegmentTypes)) {
    for (const name of Object.keys(flatSegmentTypes[segType])) {
      if (!m[segType][name]) m[segType][name] = 1.0;
    }
  }
  return m;
})();

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

function generateData(isVolume) {
  const data = {};
  const roundFn = isVolume ? roundToInt : roundTo1;
  const multiplier = isVolume ? volumePerMillionUSD : 1;

  for (const [regionName, countries] of Object.entries(regions)) {
    const regionBase = regionBaseValues[regionName] * multiplier;
    const regionGrowth = regionGrowthRates[regionName];

    data[regionName] = {};
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

console.log('Generated value/volume (flat mill-roll segments v2)');
console.log('Segment types on North America:', Object.keys(valueData['North America']));
