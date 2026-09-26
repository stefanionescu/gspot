export const DIRECTORY_FLAG = 0x80_00_00_00;

export const OFFSET_MASK = 0x7f_ff_ff_ff;

// Offsets and sizes from the PE/COFF specification, in bytes.
export const DOS_HEADER_SIZE = 64;

export const PE_OFFSET_FIELD = 60;

export const PE_SIGNATURE_SIZE = 4;

export const COFF_HEADER_SIZE = 20;

export const SECTION_COUNT_FIELD = 2;

export const OPTIONAL_HEADER_SIZE_FIELD = 16;

export const PE32_MAGIC = 0x1_0b;

export const PE32_PLUS_MAGIC = 0x2_0b;

export const PE32_DATA_DIRECTORIES = 96;

export const PE32_PLUS_DATA_DIRECTORIES = 112;

export const SIZE_OF_CODE_FIELD = 8;

export const SECTION_ALIGNMENT_FIELD = 32;

export const FILE_ALIGNMENT_FIELD = 36;

export const SIZE_OF_IMAGE_FIELD = 56;

export const SIZE_OF_HEADERS_FIELD = 60;

export const CHECKSUM_FIELD = 64;

export const DIRECTORY_ENTRY_SIZE = 8;

export const RESOURCE_DIRECTORY = 2;

export const CERTIFICATE_DIRECTORY = 4;

export const SECTION_SIZE = 40;

export const SECTION_VIRTUAL_SIZE_FIELD = 8;

export const SECTION_VIRTUAL_ADDRESS_FIELD = 12;

export const SECTION_RAW_SIZE_FIELD = 16;

export const SECTION_RAW_POINTER_FIELD = 20;

export const SECTION_CHARACTERISTICS_FIELD = 36;

export const READABLE_INITIALIZED_DATA = 0x40_00_00_40;

export const RESOURCE_TABLE_HEADER_SIZE = 16;

export const RESOURCE_NAMED_COUNT_FIELD = 12;

export const RESOURCE_ID_COUNT_FIELD = 14;

export const RESOURCE_ENTRY_SIZE = 8;

export const RESOURCE_ENTRY_TARGET_FIELD = 4;

export const RESOURCE_DATA_SIZE_FIELD = 4;

export const RCDATA_TYPE = 10;

export const WORD_SIZE = 4;
