import { m } from '@/lib/i18n'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { MixTab } from './mix-tab'
import { usePracticeUi } from './practice-store'

// MixerDrawer (12 §7, 27 §3.7.4): the Mix tab's body in a right drawer on tablets and a bottom
// sheet at 70 % height on phones, until those layouts get the inspector and the Tools sheet (s43).
// Changes are instant (gains before the stretch).
export function MixerDrawer({ phone }: { phone: boolean }) {
  const open = usePracticeUi((s) => s.mixerOpen)
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => usePracticeUi.setState({ mixerOpen: next })}
      swipeDirection={phone ? 'down' : 'right'}
      modal={false}
    >
      <DrawerContent
        className={
          phone
            ? '[--drawer-height:70dvh]'
            : 'data-[swipe-axis=x]:sm:[--drawer-content-width:23.75rem]'
        }
      >
        <DrawerHeader>
          <DrawerTitle>{m['mixer.title']()}</DrawerTitle>
          <DrawerDescription className="sr-only">{m['mixer.description']()}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
          <MixTab orientation={phone ? 'vertical' : 'horizontal'} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
