"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type SearchableSelectOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

type SearchableSelectProps = {
  id?: string
  value: string
  options: SearchableSelectOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  clearable?: boolean
  className?: string
  triggerClassName?: string
  name?: string
}

export function SearchableSelect({
  id,
  value,
  options,
  onValueChange,
  placeholder = "Seleccionar",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados",
  disabled = false,
  clearable = false,
  className,
  triggerClassName,
  name,
}: SearchableSelectProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const selected = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )

  const filteredOptions = React.useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options

    return options.filter((option) => {
      const haystack = `${option.value} ${option.label} ${option.description ?? ""}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [options, query])

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  React.useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [open])

  function selectValue(nextValue: string) {
    onValueChange(nextValue)
    setQuery("")
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      {name && <input type="hidden" name={name} value={value} />}

      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground outline-none transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
          {selected?.label || placeholder}
        </span>

        <span className="flex shrink-0 items-center gap-1">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpiar seleccion"
              onClick={(event) => {
                event.stopPropagation()
                onValueChange("")
                setQuery("")
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </span>
          )}
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div role="listbox" className="max-h-72 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const active = option.value === value

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    onClick={() => selectValue(option.value)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm outline-none transition hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50",
                      active && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        active ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.description && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
