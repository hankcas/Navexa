import { createPeopleApi } from './api'
import type { PeopleResource } from './queries'
import type { Driver, Passenger } from './types'

/** Body of POST and PATCH /drivers (backend/app/schemas/driver.py). */
export interface DriverInput {
  name: string
  code: string
  phone: string
  description: string
  custom_fields: Record<string, string>
}

/** Body of POST and PATCH /passengers (backend/app/schemas/passenger.py). */
export interface PassengerInput {
  name: string
  code: string
  custom_fields: Record<string, string>
}

export const driversResource: PeopleResource<Driver, DriverInput> = {
  key: 'drivers',
  api: createPeopleApi<Driver, DriverInput>('/drivers'),
}

export const passengersResource: PeopleResource<Passenger, PassengerInput> = {
  key: 'passengers',
  api: createPeopleApi<Passenger, PassengerInput>('/passengers'),
}
