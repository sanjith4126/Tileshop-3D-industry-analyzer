import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { setSession } from './api/client'

afterEach(cleanup)
afterEach(() => setSession(null)) // the access token lives in module memory; no test inherits another's session
