import { Icon } from "./verify/[uuid]/icons";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-4">
      <div className="badge badge-neutral" role="status">
        <Icon kind="question" />
        Not a valid certificate
      </div>
      <p className="note">
        We could not find a certificate at this address. Scan the QR code printed on the letter
        again, and check that the whole link was opened.
      </p>
    </div>
  );
}
