import { Verdict } from "./verify/[uuid]/verdict";

export default function NotFound() {
  return (
    <div className="ms-verify-col flex flex-col gap-5">
      <Verdict
        tone="unknown"
        icon="unknown"
        title="Not a valid certificate"
        note="No certificate matches this address."
      />
      <div className="flex flex-col gap-3">
        <p className="ms-verify-note">Two things are worth checking before assuming the worst:</p>
        <ul className="ms-verify-note flex list-disc flex-col gap-2 pl-5">
          <li>
            That the whole link was opened. A link split across two lines is the usual cause, and
            the address must end in a long code of letters, digits and dashes.
          </li>
          <li>That the QR code on the letter was scanned directly, rather than typed out.</li>
        </ul>
        <p className="ms-verify-note">
          If the address is right and this page still appears, the certificate is not in
          MoraSpirit&apos;s records. Contact MoraSpirit at info@moraspirit.com before relying on the
          document.
        </p>
      </div>
    </div>
  );
}
