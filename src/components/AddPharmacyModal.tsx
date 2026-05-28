import { useState } from 'react';
import {
  Modal,
  TextInput,
  Textarea,
  Button,
  Group,
  Stack,
  Text
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import { api } from '@/lib/api';

interface AddPharmacyModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PharmacyFormData {
  name: string;
  ownerName: string;
  licenseId: string;
  gstNumber: string;
  drugLicense: string;
  address: string;
  contact: string;
  ownerBirthDate: Date | null;
}

// Input sanitization
const sanitize = (input: string): string => {
  return input.replace(/[<>'"]/g, '').trim();
};

// Validation functions
const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[+]?[\d\s-]{10,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

const validateGST = (gst: string): boolean => {
  if (!gst.trim()) return true; // Optional
  // GST format: 22AAAAA0000A1Z5
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase());
};

export default function AddPharmacyModal({ opened, onClose, onSuccess }: AddPharmacyModalProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<PharmacyFormData>({
    name: '',
    ownerName: '',
    licenseId: '',
    gstNumber: '',
    drugLicense: '',
    address: '',
    contact: '',
    ownerBirthDate: null
  });

  const updateField = <K extends keyof PharmacyFormData>(field: K, value: PharmacyFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Pharmacy name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required';
    } else if (formData.ownerName.trim().length < 2) {
      newErrors.ownerName = 'Owner name must be at least 2 characters';
    }

    if (!formData.licenseId.trim()) {
      newErrors.licenseId = 'License ID is required';
    }

    if (formData.gstNumber && !validateGST(formData.gstNumber)) {
      newErrors.gstNumber = 'Invalid GST number format';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    } else if (formData.address.trim().length < 5) {
      newErrors.address = 'Address must be at least 5 characters';
    }

    if (!formData.contact.trim()) {
      newErrors.contact = 'Contact number is required';
    } else if (!validatePhone(formData.contact)) {
      newErrors.contact = 'Invalid phone format';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fix the highlighted errors',
        color: 'red'
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);

    try {
      const sanitizedData = {
        name: sanitize(formData.name),
        ownerName: sanitize(formData.ownerName),
        licenseId: sanitize(formData.licenseId),
        gstNumber: sanitize(formData.gstNumber) || null,
        drugLicense: sanitize(formData.drugLicense) || null,
        address: sanitize(formData.address),
        contact: sanitize(formData.contact),
        ownerBirthDate: formData.ownerBirthDate 
          ? (typeof formData.ownerBirthDate === 'string' ? new Date(formData.ownerBirthDate).toISOString() : (formData.ownerBirthDate as Date).toISOString())
          : null,
      };

      const result = await api.post('/api/pharmacies', sanitizedData);

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: `${sanitizedData.name} added successfully!`,
          color: 'green',
          icon: <IconCheck size={18} />
        });
        handleClose();
        onSuccess?.();
      } else {
        throw new Error(result.error || 'Failed to add pharmacy');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: String(error),
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      ownerName: '',
      licenseId: '',
      gstNumber: '',
      drugLicense: '',
      address: '',
      contact: '',
      ownerBirthDate: null
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={<Text fw={600} size="lg">Add New Pharmacy</Text>}
      size="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
    >
      <Stack gap="md">
        <Group grow>
          <TextInput
            label="Pharmacy Name"
            placeholder="Enter pharmacy name"
            required
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            error={errors.name}
          />
          <TextInput
            label="Owner Name"
            placeholder="Owner's full name"
            required
            value={formData.ownerName}
            onChange={(e) => updateField('ownerName', e.target.value)}
            error={errors.ownerName}
          />
        </Group>

        <Group grow>
          <TextInput
            label="License ID"
            placeholder="Pharmacy license ID"
            required
            value={formData.licenseId}
            onChange={(e) => updateField('licenseId', e.target.value)}
            error={errors.licenseId}
          />
          <TextInput
            label="Drug License"
            placeholder="Drug license number (Optional)"
            value={formData.drugLicense}
            onChange={(e) => updateField('drugLicense', e.target.value)}
          />
        </Group>

        <Group grow>
          <TextInput
            label="GST Number"
            placeholder="22AAAAA0000A1Z5 (Optional)"
            value={formData.gstNumber}
            onChange={(e) => updateField('gstNumber', e.target.value.toUpperCase())}
            error={errors.gstNumber}
          />
          <TextInput
            label="Contact Number"
            placeholder="+91 98765 43210"
            required
            value={formData.contact}
            onChange={(e) => updateField('contact', e.target.value)}
            error={errors.contact}
          />
        </Group>

        <DateInput
          label="Owner Birth Date"
          placeholder="Select date (Optional)"
          value={formData.ownerBirthDate}
          onChange={(date) => updateField('ownerBirthDate', date as Date | null)}
          maxDate={new Date()}
          clearable
        />
        
        <Textarea
          label="Address"
          placeholder="Full address"
          required
          minRows={2}
          value={formData.address}
          onChange={(e) => updateField('address', e.target.value)}
          error={errors.address}
        />
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button variant="default" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          Save Pharmacy
        </Button>
      </Group>
    </Modal>
  );
}
