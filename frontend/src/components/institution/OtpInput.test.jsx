import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { OtpInput } from './OtpInput'

function Harness() {
  const [value, setValue] = useState('')
  return (
    <>
      <OtpInput value={value} onChange={setValue} autoFocus />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('OtpInput', () => {
  it('accepts all six digits typed one after another', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.keyboard('895380')
    expect(screen.getByTestId('value')).toHaveTextContent('895380')
  })

  it('accepts a pasted code', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByLabelText('Digit 1 of 6'))
    await user.paste('123456')
    expect(screen.getByTestId('value')).toHaveTextContent('123456')
  })

  it('supports backspace and retyping', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.keyboard('12345')
    await user.keyboard('{Backspace}{Backspace}')
    await user.keyboard('99')
    expect(screen.getByTestId('value')).toHaveTextContent('12399')
  })

  it('ignores non-digits', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.keyboard('1a2b3')
    expect(screen.getByTestId('value')).toHaveTextContent('123')
  })
})
