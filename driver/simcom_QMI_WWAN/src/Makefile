obj-m += qmi_wwan_s.o

PWD := $(shell pwd)
OUTPUTDIR=/lib/modules/`uname -r`/kernel/drivers/net/usb/

ifeq ($(ARCH),)
ARCH := $(shell uname -m)
endif
ifeq ($(CROSS_COMPILE),)
CROSS_COMPILE :=
endif
ifeq ($(KDIR),)
KDIR := /lib/modules/$(shell uname -r)/build
ifeq ($(ARCH),i686)
ifeq ($(wildcard $KDIR/arch/$ARCH),)
ARCH=i386
endif
endif
endif

ifneq ($(findstring &,${PWD}),)
$(warning "${PWD}")
$(warning "current directory contain special char '&' !")
$(error "please remove it!")
endif

default:
	$(MAKE) ARCH=${ARCH} CROSS_COMPILE=${CROSS_COMPILE} -C $(KDIR) M=$(PWD) modules

install: default
	cp $(PWD)/qmi_wwan_s.ko /lib/modules/$(shell uname -r)/kernel/drivers/net/usb/
	depmod
	modprobe -r qmi_wwan_s
	modprobe -r qmi_wwan
	modprobe qmi_wwan_s
clean:
	rm -rf *~ .tmp_versions modules.order Module.symvers
	find . -type f -name "*~" -o -name "*.o" -o -name "*.ko" -o -name "*.cmd" -o -name "*.mod.c" |  xargs rm -rf
