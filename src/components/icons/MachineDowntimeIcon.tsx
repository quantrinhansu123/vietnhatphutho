import iconUrl from '../../assets/icon-phieu-bao-dung-may.png';

export default function MachineDowntimeIcon({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <img
      src={iconUrl}
      alt=""
      aria-hidden
      className={`object-contain ${className}`}
    />
  );
}
