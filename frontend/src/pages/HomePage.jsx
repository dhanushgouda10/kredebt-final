import { HeroSection } from '../components/home/HeroSection'
import { InfoSection } from '../components/home/InfoSection'
import { FlowSection } from '../components/home/FlowSection'
import { CampusSection } from '../components/home/CampusSection'
import { VerifySection } from '../components/home/VerifySection'

/**
 * Public landing — five sections plus footer:
 *   Hero     — what is this, and what can I do?
 *   About    — what is Kredent?
 *   Flow     — how does it work? (Issue · Secure · Verify · Trust)
 *   Campus   — who stands behind this?
 *   Verify   — what do I do now?
 */
export function HomePage() {
  return (
    <>
      <HeroSection />

      <InfoSection description="Paper degree certificates are slow to authenticate and straightforward to forge — confirming a single qualification can take an employer days of phone calls and document checks. Kredent gives MVJCE a tamper-evident way to issue degrees, so that anyone holding a certificate can establish whether it is genuine in seconds." />

      <FlowSection />

      <CampusSection />

      <VerifySection />
    </>
  )
}
