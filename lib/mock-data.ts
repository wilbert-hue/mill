import type { ComparisonData } from './types'

/**
 * Creates mock/empty data structure for the dashboard
 * This allows the UI to work without real data files
 */
export function createMockData(): ComparisonData {
  const currentYear = new Date().getFullYear()
  const startYear = currentYear - 5
  const baseYear = currentYear
  const forecastYear = currentYear + 5

  return {
    metadata: {
      market_name: 'Sample Market',
      market_type: 'Sample',
      industry: 'General',
      years: Array.from({ length: forecastYear - startYear + 1 }, (_, i) => startYear + i),
      start_year: startYear,
      base_year: baseYear,
      forecast_year: forecastYear,
      historical_years: [startYear, startYear + 1, startYear + 2, startYear + 3, baseYear - 1],
      forecast_years: Array.from({ length: forecastYear - baseYear + 1 }, (_, i) => baseYear + i),
      currency: 'USD',
      value_unit: 'Million',
      volume_unit: 'Units',
      has_value: true,
      has_volume: true
    },
    dimensions: {
      geographies: {
        global: ['Global'],
        regions: [],
        countries: {},
        all_geographies: ['Global']
      },
      segments: {
        'By Rolling Process': {
          type: 'flat',
          items: [],
          hierarchy: {}
        }
      }
    },
    data: {
      value: {
        geography_segment_matrix: []
      },
      volume: {
        geography_segment_matrix: []
      }
    }
  }
}

