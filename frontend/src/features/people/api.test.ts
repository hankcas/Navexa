import { afterEach, describe, expect, it, vi } from 'vitest'

import { json, stubFetch } from '../../test/fetchStub'
import { peopleListPath } from './api'
import { driversResource, passengersResource } from './resources'

const BASE = { search: '', assignment: 'all' as const, page: 1, pageSize: 20 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('peopleListPath', () => {
  it('sends only the filters that are set', () => {
    expect(peopleListPath('/drivers', BASE)).toBe('/drivers?page=1&page_size=20')
    expect(peopleListPath('/drivers', { ...BASE, search: ' ana ', assignment: 'assigned', page: 2 })).toBe(
      '/drivers?page=2&page_size=20&search=ana&assigned=true',
    )
    expect(peopleListPath('/passengers', { ...BASE, assignment: 'unassigned' })).toBe(
      '/passengers?page=1&page_size=20&assigned=false',
    )
  })
})

describe('export paths', () => {
  it('carry the same filters as the list, without pagination', () => {
    expect(driversResource.api.exportPath({ search: '', assignment: 'all' })).toBe('/drivers/export')
    expect(passengersResource.api.exportPath({ search: ' sara ', assignment: 'unassigned' })).toBe(
      '/passengers/export?search=sara&assigned=false',
    )
  })
})

describe('people API clients', () => {
  it('assigns a vehicle with PUT and the vehicle id in the body', async () => {
    const fetchMock = vi.fn(async () => json(200, { id: '1-7', vehicle_id: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await driversResource.api.assignVehicle('1-7', 500)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/drivers/1-7/vehicle')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ vehicle_id: 500 })
  })

  it('uses the passengers path for passengers', async () => {
    const http = stubFetch({ '/api/v1/passengers/1-12/vehicle': [json(200, { id: '1-12', vehicle_id: null })] })
    await passengersResource.api.unassignVehicle('1-12')
    expect(http.callsTo('/api/v1/passengers/1-12/vehicle')).toBe(1)
  })
})
