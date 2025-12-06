// VSCode-style layout icons for panel controls
export function LayoutSidebarLeft({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 1L1 2V14L2 15H14L15 14V2L14 1H2ZM2 14V2H5V14H2ZM6 2H14V14H6V2Z"
      />
    </svg>
  )
}

export function LayoutSidebarLeftOff({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
    >
      <path d="M2 1L1 2V14L2 15H14L15 14V2L14 1H2ZM2 14V2H14V14H2Z" />
    </svg>
  )
}

export function LayoutSidebarRight({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 1L1 2V14L2 15H14L15 14V2L14 1H2ZM14 14V2H11V14H14ZM10 2H2V14H10V2Z"
      />
    </svg>
  )
}

export function LayoutSidebarRightOff({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
    >
      <path d="M2 1L1 2V14L2 15H14L15 14V2L14 1H2ZM2 14V2H14V14H2Z" />
    </svg>
  )
}

export function LayoutPanel({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 1L1 2V14L2 15H14L15 14V2L14 1H2ZM2 9V2H14V9H2ZM2 10H14V14H2V10Z"
      />
    </svg>
  )
}

export function LayoutPanelOff({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      className={className}
    >
      <path d="M2 1L1 2V14L2 15H14L15 14V2L14 1H2ZM2 14V2H14V14H2Z" />
    </svg>
  )
}
