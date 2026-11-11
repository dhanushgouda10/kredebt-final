import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CollegeSelect } from './CollegeSelect'

const COLLEGES = [
  { institutionId: 'KR-2026-00001', name: 'Greenfield Institute', state: 'Karnataka', district: 'Bengaluru', joinedKredent: true },
  { institutionId: 'KR-2026-00002', name: 'Riverbend College', state: 'Maharashtra', district: 'Pune', joinedKredent: false },
]

function Harness({ colleges = COLLEGES }) {
  const [value, setValue] = useState('')
  return (
    <>
      <CollegeSelect colleges={colleges} value={value} onChange={(e) => setValue(e.target.value)} />
      <output data-testid="picked">{value}</output>
    </>
  )
}

describe('CollegeSelect', () => {
  it('lists the registered colleges and lets a joined one be chosen', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.selectOptions(screen.getByLabelText(/college/i), 'KR-2026-00001')
    expect(screen.getByTestId('picked')).toHaveTextContent('KR-2026-00001')
  })

  it('disables colleges that have not joined yet and says why', () => {
    render(<Harness />)
    const option = screen.getByRole('option', { name: /Riverbend College.*not available yet/i })
    expect(option).toBeDisabled()
  })

  it('shows a message when no college is registered', () => {
    render(<Harness colleges={[]} />)
    expect(screen.getByText(/no colleges are registered yet/i)).toBeInTheDocument()
  })

  it('offers a search box once the list is long', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      institutionId: `KR-2026-1000${i}`, name: `College ${i}`, state: 'Karnataka', district: 'Bengaluru', joinedKredent: true,
    }))
    const user = userEvent.setup()
    render(<Harness colleges={many} />)
    await user.type(screen.getByLabelText('Search colleges'), 'College 7')
    expect(screen.getAllByRole('option').map((o) => o.textContent).join('|')).toMatch(/College 7/)
    expect(screen.queryByRole('option', { name: /College 3/ })).not.toBeInTheDocument()
  })
})
